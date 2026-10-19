import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test.db")
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def demo_client(client):
    response = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    return client


@pytest.fixture
def auth_client(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "wonderland9"},
    )
    assert response.status_code == 200
    return client
