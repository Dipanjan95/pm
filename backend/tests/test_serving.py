def test_health_route(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "hello world"}


def test_root_serves_frontend_shell(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text


def test_protected_routes_reject_requests_without_a_session(client):
    assert client.get("/api/boards").status_code == 401
    assert client.get("/api/boards/board-1").status_code == 401
    assert client.put("/api/boards/board-1", json={"columns": [], "cards": {}}).status_code == 401
    assert client.get("/api/boards/board-1/messages").status_code == 401
    assert client.get("/api/ai/status").status_code == 401
    assert client.post("/api/ai/test").status_code == 401
    assert client.post("/api/ai/chat", json={"board_id": "board-1", "message": "Move a card"}).status_code == 401
