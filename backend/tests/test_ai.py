import json
from urllib import error

import pytest
from fastapi.testclient import TestClient

from app import main


class FakeProviderResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return json.dumps(self.body).encode("utf-8")


def provider_response(content):
    return {"choices": [{"message": {"content": content}}]}


def seed_board_cards(client, board_id):
    board = client.get(f"/api/boards/{board_id}").json()
    column_ids = [column["id"] for column in board["columns"]]
    state = {
        "columns": [
            {"id": column_ids[0], "title": "Backlog", "cardIds": ["card-a"]},
            {"id": column_ids[1], "title": "Discovery", "cardIds": ["card-b"]},
            {"id": column_ids[2], "title": "In Progress", "cardIds": ["card-c"]},
            {"id": column_ids[3], "title": "Review", "cardIds": []},
            {"id": column_ids[4], "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-a": {"id": "card-a", "title": "Original", "details": "", "due_date": None},
            "card-b": {"id": "card-b", "title": "Movable", "details": "", "due_date": None},
            "card-c": {"id": "card-c", "title": "Doomed", "details": "", "due_date": None},
        },
    }
    assert client.put(f"/api/boards/{board_id}", json=state).status_code == 200
    return column_ids


def test_ai_status_reports_missing_key(auth_client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    response = auth_client.get("/api/ai/status")
    assert response.status_code == 200
    assert response.json()["status"] == "disabled"


def test_ai_connectivity_route_parses_a_json_response(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def fake_urlopen(req, timeout):
        assert timeout == 30
        assert json.loads(req.data)["model"] == main.AI_MODEL
        return FakeProviderResponse(provider_response('{"answer":"4"}'))

    monkeypatch.setattr(main.request, "urlopen", fake_urlopen)
    response = auth_client.post("/api/ai/test")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "response": "4"}


def test_ai_chat_applies_all_action_types_to_the_requested_board(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    column_ids = seed_board_cards(auth_client, board_id)

    structured = {
        "reply": "I updated the board.",
        "actions": [
            {"action": "update", "card_id": "card-a", "column_id": None, "title": "Renamed by AI", "details": None, "position": None},
            {"action": "move", "card_id": "card-b", "column_id": column_ids[4], "title": None, "details": None, "position": 0},
            {"action": "create", "card_id": None, "column_id": column_ids[3], "title": "Follow up", "details": "Check next week.", "position": None},
            {"action": "delete", "card_id": "card-c", "column_id": None, "title": None, "details": None, "position": None},
        ],
    }
    provider_requests = []

    def fake_urlopen(req, timeout):
        provider_requests.append(json.loads(req.data))
        return FakeProviderResponse(provider_response(json.dumps(structured)))

    monkeypatch.setattr(main.request, "urlopen", fake_urlopen)
    response = auth_client.post(
        "/api/ai/chat",
        json={"board_id": board_id, "message": "Update, move, create, and remove the agreed cards."},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["reply"] == "I updated the board."
    assert result["actions_applied"] == 4
    assert result["board"]["cards"]["card-a"]["title"] == "Renamed by AI"
    assert "card-c" not in result["board"]["cards"]
    assert result["board"]["columns"][4]["cardIds"] == ["card-b"]
    assert any(card["title"] == "Follow up" for card in result["board"]["cards"].values())

    sent = provider_requests[0]
    assert sent["response_format"]["type"] == "json_schema"
    assert "card-a" in sent["messages"][0]["content"]
    assert sent["messages"][-1]["content"] == "Update, move, create, and remove the agreed cards."


def test_ai_chat_persists_history_and_sends_it_back(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    def fake_urlopen(req, timeout):
        return FakeProviderResponse(provider_response(json.dumps({"reply": "Noted.", "actions": []})))

    monkeypatch.setattr(main.request, "urlopen", fake_urlopen)
    first = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Hello assistant."})
    assert first.status_code == 200

    messages = auth_client.get(f"/api/boards/{board_id}/messages").json()
    assert messages == [
        {"role": "user", "content": "Hello assistant."},
        {"role": "assistant", "content": "Noted."},
    ]

    captured = {}

    def capturing_urlopen(req, timeout):
        captured["messages"] = json.loads(req.data)["messages"]
        return FakeProviderResponse(provider_response(json.dumps({"reply": "Again.", "actions": []})))

    monkeypatch.setattr(main.request, "urlopen", capturing_urlopen)
    second = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "And again."})
    assert second.status_code == 200

    roles = [message["role"] for message in captured["messages"]]
    assert roles == ["system", "user", "assistant", "user"]
    assert captured["messages"][1] == {"role": "user", "content": "Hello assistant."}
    assert captured["messages"][2] == {"role": "assistant", "content": "Noted."}


def test_invalid_ai_action_does_not_change_the_board_or_history(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    invalid = {
        "reply": "I moved a card.",
        "actions": [
            {"action": "move", "card_id": "card-a", "column_id": "unknown", "title": None, "details": None, "position": None}
        ],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(invalid))),
    )
    original_board = auth_client.get(f"/api/boards/{board_id}").json()

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Move card a."})

    assert response.status_code == 502
    assert auth_client.get(f"/api/boards/{board_id}").json() == original_board
    assert auth_client.get(f"/api/boards/{board_id}/messages").json() == []


def test_ai_chat_rejects_malformed_provider_output(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response("not json")),
    )

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Help me plan."})

    assert response.status_code == 502


def test_ai_endpoints_without_a_key_return_503(auth_client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    assert auth_client.post("/api/ai/test").status_code == 503
    chat = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Hello."})
    assert chat.status_code == 503


def test_ai_provider_failure_returns_502(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    def failing_urlopen(req, timeout):
        raise error.URLError("connection refused")

    monkeypatch.setattr(main.request, "urlopen", failing_urlopen)
    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Hello."})

    assert response.status_code == 502


def test_ai_test_rejects_invalid_provider_payloads(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response('{"unexpected": true}')),
    )
    assert auth_client.post("/api/ai/test").status_code == 502

    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response("null")),
    )
    assert auth_client.post("/api/ai/test").status_code == 502


def test_ai_provider_returning_a_non_string_content_is_rejected(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse({"choices": [{"message": {"content": None}}]}),
    )

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Hello."})

    assert response.status_code == 502


@pytest.mark.parametrize(
    "action",
    [
        {"action": "create", "card_id": "card-a", "column_id": "col", "title": "T", "details": None, "position": None},
        {"action": "create", "card_id": None, "column_id": "col", "title": "T", "details": None, "position": 2},
        {"action": "update", "card_id": "card-a", "column_id": None, "title": None, "details": None, "position": None},
        {"action": "update", "card_id": "card-a", "column_id": "col", "title": "T", "details": None, "position": None},
        {"action": "move", "card_id": "card-a", "column_id": None, "title": None, "details": None, "position": None},
        {"action": "move", "card_id": "card-a", "column_id": "col", "title": "T", "details": None, "position": None},
        {"action": "delete", "card_id": None, "column_id": None, "title": None, "details": None, "position": None},
        {"action": "delete", "card_id": "card-a", "column_id": "col", "title": None, "details": None, "position": None},
    ],
)
def test_structurally_invalid_ai_actions_are_rejected(auth_client, monkeypatch, action):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    invalid = {"reply": "Done.", "actions": [action]}
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(invalid))),
    )
    original_board = auth_client.get(f"/api/boards/{board_id}").json()

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Do something invalid."})

    assert response.status_code == 502
    assert auth_client.get(f"/api/boards/{board_id}").json() == original_board


def test_ai_action_referencing_a_detached_card_is_rejected(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    column_ids = seed_board_cards(auth_client, board_id)

    # card-c exists in cards but is removed from every column, so it has no valid placement.
    state = auth_client.get(f"/api/boards/{board_id}").json()
    state["columns"][2]["cardIds"] = []
    assert auth_client.put(f"/api/boards/{board_id}", json=state).status_code == 200
    original_board = auth_client.get(f"/api/boards/{board_id}").json()

    detached = {
        "reply": "I moved it.",
        "actions": [
            {"action": "move", "card_id": "card-c", "column_id": column_ids[4], "title": None, "details": None, "position": None}
        ],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(detached))),
    )
    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Move the detached card."})

    assert response.status_code == 502
    assert auth_client.get(f"/api/boards/{board_id}").json() == original_board


def test_ai_chat_rejects_conflicting_actions_for_one_card(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    seed_board_cards(auth_client, board_id)

    conflicting = {
        "reply": "I did both.",
        "actions": [
            {"action": "update", "card_id": "card-a", "column_id": None, "title": "First edit", "details": None, "position": None},
            {"action": "delete", "card_id": "card-a", "column_id": None, "title": None, "details": None, "position": None},
        ],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(conflicting))),
    )
    original_board = auth_client.get(f"/api/boards/{board_id}").json()

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Rename and delete card a."})

    assert response.status_code == 502
    assert auth_client.get(f"/api/boards/{board_id}").json() == original_board


def test_ai_create_into_an_unknown_column_is_rejected(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    seed_board_cards(auth_client, board_id)

    unknown_column = {
        "reply": "Created it.",
        "actions": [
            {"action": "create", "card_id": None, "column_id": "col-unknown", "title": "Lost card", "details": None, "position": None}
        ],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(unknown_column))),
    )
    original_board = auth_client.get(f"/api/boards/{board_id}").json()

    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Create a card somewhere odd."})

    assert response.status_code == 502
    assert auth_client.get(f"/api/boards/{board_id}").json() == original_board


def test_ai_update_can_change_only_the_details(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    seed_board_cards(auth_client, board_id)

    details_only = {
        "reply": "Details updated.",
        "actions": [
            {"action": "update", "card_id": "card-a", "column_id": None, "title": None, "details": "Fresh details", "position": None}
        ],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps(details_only))),
    )
    response = auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Add details to card a."})

    assert response.status_code == 200
    assert response.json()["board"]["cards"]["card-a"]["details"] == "Fresh details"


def test_apply_ai_actions_rejects_cards_with_ambiguous_placements():
    board = {
        "columns": [
            {"id": "col-1", "title": "A", "cardIds": ["card-1"]},
            {"id": "col-2", "title": "B", "cardIds": ["card-1"]},
        ],
        "cards": {"card-1": {"id": "card-1", "title": "T", "details": ""}},
    }
    action = main.BoardAction(
        action="move",
        card_id="card-1",
        column_id="col-2",
        title=None,
        details=None,
        position=None,
    )

    with pytest.raises(ValueError):
        main.apply_ai_actions(board, [action])


def test_ai_test_rejects_a_non_string_answer(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response('{"answer": 4}')),
    )

    response = auth_client.post("/api/ai/test")

    assert response.status_code == 502


def test_ai_chat_requires_board_ownership(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    client.post("/api/auth/register", json={"username": "alice", "password": "wonderland9"})
    board_id = client.get("/api/boards").json()[0]["id"]

    with TestClient(main.app) as other:
        other.post("/api/auth/register", json={"username": "bob", "password": "builder123"})
        response = other.post("/api/ai/chat", json={"board_id": board_id, "message": "Let me in."})
        assert response.status_code == 404


def test_deleting_a_board_removes_its_chat_history(auth_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse(provider_response(json.dumps({"reply": "Noted.", "actions": []}))),
    )
    assert auth_client.post("/api/ai/chat", json={"board_id": board_id, "message": "Hello."}).status_code == 200

    assert auth_client.delete(f"/api/boards/{board_id}").status_code == 200
    with main.get_connection() as connection:
        remaining = connection.execute(
            "SELECT COUNT(*) FROM chat_messages WHERE board_id = ?",
            (board_id,),
        ).fetchone()[0]
    assert remaining == 0
