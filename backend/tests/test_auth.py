from fastapi.testclient import TestClient

from app import main


def test_register_creates_user_board_and_session(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "wonderland9"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "username": "alice"}
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "samesite=strict" in response.headers["set-cookie"].lower()

    session = client.get("/api/auth/session")
    assert session.status_code == 200
    assert session.json()["username"] == "alice"

    boards = client.get("/api/boards").json()
    assert [board["title"] for board in boards] == ["Main Board"]

    board = client.get(f"/api/boards/{boards[0]['id']}").json()
    assert [column["title"] for column in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert board["cards"] == {}


def test_register_rejects_duplicate_usernames(client):
    first = client.post("/api/auth/register", json={"username": "alice", "password": "wonderland9"})
    assert first.status_code == 200
    second = client.post("/api/auth/register", json={"username": "alice", "password": "different9"})
    assert second.status_code == 409


def test_register_validates_input(client):
    assert client.post("/api/auth/register", json={"username": "ab", "password": "wonderland9"}).status_code == 422
    assert client.post("/api/auth/register", json={"username": "bad name!", "password": "wonderland9"}).status_code == 422
    assert client.post("/api/auth/register", json={"username": "alice", "password": "short"}).status_code == 422


def test_login_rejects_invalid_credentials(client):
    assert client.post("/api/auth/login", json={"username": "user", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "nobody", "password": "password"}).status_code == 401


def test_demo_user_can_sign_in(demo_client):
    session = demo_client.get("/api/auth/session")
    assert session.status_code == 200
    assert session.json()["username"] == "user"


def test_logout_revokes_the_session(client):
    client.post("/api/auth/register", json={"username": "alice", "password": "wonderland9"})
    assert client.get("/api/boards").status_code == 200
    token = client.cookies.get(main.SESSION_COOKIE_NAME)

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/boards").status_code == 401

    client.cookies.set(main.SESSION_COOKIE_NAME, token)
    assert client.get("/api/boards").status_code == 401


def test_users_are_isolated_from_each_other(client):
    client.post("/api/auth/register", json={"username": "alice", "password": "wonderland9"})
    board_id = client.get("/api/boards").json()[0]["id"]

    with TestClient(main.app) as other:
        registered = other.post("/api/auth/register", json={"username": "bob", "password": "builder123"})
        assert registered.status_code == 200

        assert other.get(f"/api/boards/{board_id}").status_code == 404
        assert other.put(f"/api/boards/{board_id}", json={"columns": [], "cards": {}}).status_code == 404
        assert other.patch(f"/api/boards/{board_id}", json={"title": "Stolen"}).status_code == 404
        assert other.delete(f"/api/boards/{board_id}").status_code == 404
        assert other.get(f"/api/boards/{board_id}/messages").status_code == 404

        bob_boards = other.get("/api/boards").json()
        assert [board["title"] for board in bob_boards] == ["Main Board"]
        assert bob_boards[0]["id"] != board_id


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
    with main.get_connection() as connection, connection:
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


def test_verify_password_rejects_malformed_hashes():
    assert main.verify_password("password", "garbage") is False
    assert main.verify_password("password", "scrypt$600000$aa$bb") is False
    assert main.verify_password("password", "pbkdf2_sha256$notanumber$aa$bb") is False
    assert main.verify_password("password", "pbkdf2_sha256$600000$zz$bb") is False
