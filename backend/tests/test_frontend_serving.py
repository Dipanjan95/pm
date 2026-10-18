import json
import os

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


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test.db")
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def authenticated_client(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200
    return client


def test_health_route(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "hello world"}


def test_root_serves_frontend_shell(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text


def test_protected_routes_reject_requests_without_a_session(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401
    assert client.get("/api/ai/status").status_code == 401
    assert client.post("/api/ai/test").status_code == 401
    assert client.post("/api/ai/chat", json={"message": "Move a card"}).status_code == 401


def test_login_rejects_invalid_credentials_and_logout_revokes_session(client):
    invalid_response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "wrong"},
    )
    assert invalid_response.status_code == 401

    login_response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert login_response.status_code == 200
    assert "httponly" in login_response.headers["set-cookie"].lower()
    assert "samesite=strict" in login_response.headers["set-cookie"].lower()
    session_token = login_response.cookies.get(main.SESSION_COOKIE_NAME)
    assert client.get("/api/auth/session").status_code == 200
    assert client.get("/api/board").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/board").status_code == 401
    assert session_token is not None
    client.cookies.set(main.SESSION_COOKIE_NAME, session_token)
    assert client.get("/api/board").status_code == 401


def test_database_stores_a_password_hash(client):
    main.initialize_database()
    with main.get_connection() as connection:
        password_hash = connection.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            ("user",),
        ).fetchone()["password_hash"]

    assert password_hash != "password"
    assert password_hash.startswith("pbkdf2_sha256$")
    assert main.verify_password("password", password_hash)


def test_database_migrates_existing_plaintext_password(client):
    main.initialize_database()
    with main.get_connection() as connection:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            ("password", "user"),
        )

    main.initialize_database()
    with main.get_connection() as connection:
        password_hash = connection.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            ("user",),
        ).fetchone()["password_hash"]

    assert password_hash != "password"
    assert main.verify_password("password", password_hash)


def test_board_route_returns_default_board(authenticated_client):
    response = authenticated_client.get("/api/board")
    assert response.status_code == 200
    payload = response.json()
    assert payload["columns"][0]["title"] == "Backlog"
    assert len(payload["cards"]) == 8


def test_board_route_persists_board_updates(authenticated_client):
    board = {
        "columns": [
            {"id": "todo", "title": "To do", "cardIds": ["card-101"]},
            {"id": "done", "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-101": {"id": "card-101", "title": "Persisted card", "details": "Stored"}
        },
    }

    update_response = authenticated_client.put("/api/board", json=board)
    assert update_response.status_code == 200

    get_response = authenticated_client.get("/api/board")
    assert get_response.status_code == 200
    assert get_response.json()["cards"]["card-101"]["title"] == "Persisted card"


def test_ai_status_reports_missing_key(authenticated_client):
    original = os.environ.get("OPENROUTER_API_KEY")
    os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        response = authenticated_client.get("/api/ai/status")
        assert response.status_code == 200
        assert response.json()["status"] == "disabled"
    finally:
        if original is not None:
            os.environ["OPENROUTER_API_KEY"] = original


def test_ai_connectivity_route_parses_a_json_response(authenticated_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def fake_urlopen(req, timeout):
        assert timeout == 30
        assert json.loads(req.data)["model"] == main.AI_MODEL
        return FakeProviderResponse({"choices": [{"message": {"content": '{"answer":"4"}'}}]})

    monkeypatch.setattr(main.request, "urlopen", fake_urlopen)
    response = authenticated_client.post("/api/ai/test")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "response": "4"}


def test_ai_chat_includes_context_and_applies_all_action_types(authenticated_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    provider_requests = []
    structured_response = {
        "reply": "I updated the board.",
        "actions": [
            {"action": "update", "card_id": "card-1", "column_id": None, "title": "Roadmap approved", "details": None, "position": None},
            {"action": "move", "card_id": "card-3", "column_id": "col-done", "title": None, "details": None, "position": 0},
            {"action": "create", "card_id": None, "column_id": "col-progress", "title": "Follow up", "details": "Check next week.", "position": None},
            {"action": "delete", "card_id": "card-7", "column_id": None, "title": None, "details": None, "position": None},
        ],
    }

    def fake_urlopen(req, timeout):
        provider_requests.append(json.loads(req.data))
        return FakeProviderResponse({"choices": [{"message": {"content": json.dumps(structured_response)}}]})

    monkeypatch.setattr(main.request, "urlopen", fake_urlopen)
    response = authenticated_client.post(
        "/api/ai/chat",
        json={
            "message": "Update, move, create, and remove the agreed cards.",
            "history": [{"role": "assistant", "content": "I can update the board."}],
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["reply"] == "I updated the board."
    assert result["actions_applied"] == 4
    assert result["board"]["cards"]["card-1"]["title"] == "Roadmap approved"
    assert "card-7" not in result["board"]["cards"]
    assert result["board"]["columns"][4]["cardIds"][0] == "card-3"
    assert any(card["title"] == "Follow up" for card in result["board"]["cards"].values())
    sent = provider_requests[0]
    assert sent["response_format"]["type"] == "json_schema"
    assert "card-1" in sent["messages"][0]["content"]
    assert sent["messages"][1]["role"] == "assistant"
    assert sent["messages"][2]["content"] == "Update, move, create, and remove the agreed cards."


def test_invalid_ai_action_does_not_change_the_board(authenticated_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    invalid_response = {
        "reply": "I moved a card.",
        "actions": [{"action": "move", "card_id": "card-1", "column_id": "unknown", "title": None, "details": None, "position": None}],
    }
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse({"choices": [{"message": {"content": json.dumps(invalid_response)}}]}),
    )
    original_board = authenticated_client.get("/api/board").json()

    response = authenticated_client.post("/api/ai/chat", json={"message": "Move card 1."})

    assert response.status_code == 502
    assert authenticated_client.get("/api/board").json() == original_board


def test_ai_chat_rejects_malformed_provider_output(authenticated_client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        main.request,
        "urlopen",
        lambda req, timeout: FakeProviderResponse({"choices": [{"message": {"content": "not json"}}]}),
    )

    response = authenticated_client.post("/api/ai/chat", json={"message": "Help me plan."})

    assert response.status_code == 502
