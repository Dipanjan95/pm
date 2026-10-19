def test_demo_user_gets_a_seeded_board(demo_client):
    boards = demo_client.get("/api/boards").json()
    assert [board["title"] for board in boards] == ["Main Board"]

    board = demo_client.get(f"/api/boards/{boards[0]['id']}").json()
    assert len(board["columns"]) == 5
    assert len(board["cards"]) == 8


def test_create_board_and_list(client):
    client.post("/api/auth/register", json={"username": "alice", "password": "wonderland9"})

    created = client.post("/api/boards", json={"title": "Side Project"})
    assert created.status_code == 200
    board = created.json()
    assert board["title"] == "Side Project"
    assert [column["title"] for column in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert board["cards"] == {}

    listed = client.get("/api/boards").json()
    assert [item["title"] for item in listed] == ["Main Board", "Side Project"]


def test_board_state_round_trip_with_due_date(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    column_id = auth_client.get(f"/api/boards/{board_id}").json()["columns"][0]["id"]

    payload = {
        "columns": [{"id": column_id, "title": "Backlog", "cardIds": ["card-101"]}],
        "cards": {
            "card-101": {
                "id": "card-101",
                "title": "Persisted card",
                "details": "Stored",
                "due_date": "2026-11-01",
            }
        },
    }
    saved = auth_client.put(f"/api/boards/{board_id}", json=payload)
    assert saved.status_code == 200

    fetched = auth_client.get(f"/api/boards/{board_id}").json()
    assert fetched["cards"]["card-101"]["due_date"] == "2026-11-01"
    assert fetched["columns"][0]["cardIds"] == ["card-101"]


def test_cards_without_a_due_date_round_trip_as_null(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    column_id = auth_client.get(f"/api/boards/{board_id}").json()["columns"][0]["id"]

    payload = {
        "columns": [{"id": column_id, "title": "Backlog", "cardIds": ["card-101"]}],
        "cards": {"card-101": {"id": "card-101", "title": "No date", "details": ""}},
    }
    assert auth_client.put(f"/api/boards/{board_id}", json=payload).status_code == 200

    fetched = auth_client.get(f"/api/boards/{board_id}").json()
    assert fetched["cards"]["card-101"]["due_date"] is None


def test_save_skips_card_ids_missing_from_cards(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]
    column_id = auth_client.get(f"/api/boards/{board_id}").json()["columns"][0]["id"]

    payload = {
        "columns": [{"id": column_id, "title": "Backlog", "cardIds": ["ghost", "card-101"]}],
        "cards": {"card-101": {"id": "card-101", "title": "Real card", "details": ""}},
    }
    assert auth_client.put(f"/api/boards/{board_id}", json=payload).status_code == 200

    fetched = auth_client.get(f"/api/boards/{board_id}").json()
    assert fetched["columns"][0]["cardIds"] == ["card-101"]


def test_rename_board(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    renamed = auth_client.patch(f"/api/boards/{board_id}", json={"title": "Renamed"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed"
    assert auth_client.get("/api/boards").json()[0]["title"] == "Renamed"


def test_delete_board_removes_the_board(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    assert auth_client.delete(f"/api/boards/{board_id}").status_code == 200
    assert auth_client.get("/api/boards").json() == []
    assert auth_client.get(f"/api/boards/{board_id}").status_code == 404


def test_unknown_board_returns_404(auth_client):
    assert auth_client.get("/api/boards/missing").status_code == 404
    assert auth_client.patch("/api/boards/missing", json={"title": "x"}).status_code == 404
    assert auth_client.delete("/api/boards/missing").status_code == 404


def test_board_state_validates_payload(auth_client):
    board_id = auth_client.get("/api/boards").json()[0]["id"]

    bad_payload = {"columns": [{"id": "c1"}], "cards": {}}
    assert auth_client.put(f"/api/boards/{board_id}", json=bad_payload).status_code == 422

    bad_title = {"title": ""}
    assert auth_client.patch(f"/api/boards/{board_id}", json=bad_title).status_code == 422
