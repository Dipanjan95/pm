import sqlite3
from contextlib import closing

from app import main

LEGACY_SCHEMA = """
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE board_columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(board_id) REFERENCES boards(id)
);
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(board_id) REFERENCES boards(id),
    FOREIGN KEY(column_id) REFERENCES board_columns(id)
);
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    board_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(board_id) REFERENCES boards(id)
);
CREATE TABLE auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
INSERT INTO users VALUES ('user', 'user', '{hash}', '2026-01-01');
INSERT INTO boards VALUES ('board-old', 'user', 'Main Board', '2026-01-01', '2026-01-01');
INSERT INTO board_columns VALUES ('col-old', 'board-old', 'Backlog', 0, '2026-01-01');
INSERT INTO cards VALUES ('card-old', 'board-old', 'col-old', 'Legacy card', 'Details', 0, '2026-01-01', '2026-01-01');
"""


def test_existing_database_migrates_cards_to_include_due_dates(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(LEGACY_SCHEMA.format(hash=main.hash_password("password")))
    connection.commit()
    connection.close()

    monkeypatch.setattr(main, "DB_PATH", db_path)
    main.initialize_database()

    with closing(main.get_connection()) as connection:
        column_names = [row["name"] for row in connection.execute("PRAGMA table_info(cards)")]
        legacy_card = connection.execute(
            "SELECT title, due_date FROM cards WHERE id = 'card-old'"
        ).fetchone()

    assert "due_date" in column_names
    assert legacy_card["title"] == "Legacy card"
    assert legacy_card["due_date"] is None


def test_migrated_board_serves_through_the_api(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(LEGACY_SCHEMA.format(hash=main.hash_password("password")))
    connection.commit()
    connection.close()

    monkeypatch.setattr(main, "DB_PATH", db_path)
    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        assert client.post("/api/auth/login", json={"username": "user", "password": "password"}).status_code == 200
        boards = client.get("/api/boards").json()
        assert [board["id"] for board in boards] == ["board-old"]

        board = client.get("/api/boards/board-old").json()
        assert board["columns"][0]["cardIds"] == ["card-old"]
        assert board["cards"]["card-old"]["due_date"] is None
