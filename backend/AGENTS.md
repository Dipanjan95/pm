# Backend Agent Guide

This backend is a FastAPI service for the Project Management MVP. It serves the static Next.js export, authenticates the local demo user, persists the Kanban board in SQLite, and mediates OpenRouter requests.

## Current scaffold

## Current implementation

- app/main.py: FastAPI entrypoint, SQLite initialization and migrations, signed-in session handling, board routes, OpenRouter connectivity check, structured AI chat, and static frontend mounting.
- pyproject.toml: uv-managed Python project configuration.
- uv.lock: generated lockfile for reproducible dependency installation.
- tests/test_frontend_serving.py: API, persistence, authentication, and mocked AI tests.

## Runtime expectations

- Python 3.12+
- uv for dependency management
- FastAPI + uvicorn
- Local development through uvicorn or docker compose

## Routes

- GET /: serves the static Next.js export.
- GET /api/health and GET /api/hello: unauthenticated runtime checks.
- POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout: local login and revocable HttpOnly sessions.
- GET /api/board, PUT /api/board, POST /api/board: authenticated board load and save.
- GET /api/ai/status, POST /api/ai/test, POST /api/ai/chat: authenticated AI readiness, provider check, and structured board assistant.

## Persistence and AI

- SQLite is initialized in backend/data/project_management_mvp.db. The Compose service mounts that directory to a named volume.
- Demo credentials are stored as PBKDF2 hashes; existing plaintext demo password rows are migrated on startup.
- AI changes are schema-validated, limited to known board/card IDs and supported actions, then persisted only after all actions validate.
- `OPENROUTER_API_KEY` is read from the root `.env` through Compose; never commit the key.

## Working expectations

- Run tests from backend/ with `uv run python -m pytest -q`.
- Mock OpenRouter in tests; do not make tests depend on a real API key or provider availability.
- Keep route and persistence changes covered by focused tests.