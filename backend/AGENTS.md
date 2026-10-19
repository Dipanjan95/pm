# Backend Agent Guide

This backend is a FastAPI service for the Project Management MVP. It serves the static Next.js export, authenticates the local demo user, persists the Kanban board in SQLite, and mediates OpenRouter requests.

## Current scaffold

## Current implementation

- app/main.py: FastAPI entrypoint, SQLite initialization and migrations, registration and per-user sessions, board CRUD routes, chat message persistence, OpenRouter requests, structured AI chat, and static frontend mounting.
- pyproject.toml: uv-managed Python project configuration.
- uv.lock: generated lockfile for reproducible dependency installation.
- tests/: pytest suites (conftest fixtures plus serving, auth, boards, migrations, and AI tests).

## Runtime expectations

- Python 3.12+
- uv for dependency management
- FastAPI + uvicorn
- Local development through uvicorn or docker compose

## Routes

- GET /: serves the static Next.js export.
- GET /api/health: unauthenticated runtime check.
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout: registration with a default board, per-user login, and revocable HttpOnly sessions.
- GET /api/boards, POST /api/boards: authenticated board list and creation (new boards get the five default columns).
- GET /api/boards/{board_id}, PATCH /api/boards/{board_id}, PUT /api/boards/{board_id}, DELETE /api/boards/{board_id}: board detail, rename, full-state save, and cascade delete, all scoped to the owning user.
- GET /api/boards/{board_id}/messages: persisted AI conversation for a board.
- GET /api/ai/status, POST /api/ai/test, POST /api/ai/chat: authenticated AI readiness, provider check, and structured board assistant scoped to a board.

## Persistence and AI

- SQLite is initialized in backend/data/project_management_mvp.db once at startup (lifespan). The Compose service mounts that directory to a named volume.
- Startup migrations add cards.due_date for existing databases and re-hash an existing plaintext demo password.
- Demo credentials are stored as PBKDF2 hashes; registered users get their own hashed credentials.
- Board payloads are validated with typed Pydantic models; AI changes are schema-validated, limited to known board/card IDs and supported actions, then persisted only after all actions validate.
- Chat turns (user and assistant) are persisted per board and replayed as provider context for follow-up requests.
- `OPENROUTER_API_KEY` is read from the root `.env` through Compose; never commit the key.

## Working expectations

- Run tests from backend/ with `uv run python -m pytest -q --cov=app` (coverage via pytest-cov).
- Mock OpenRouter in tests; do not make tests depend on a real API key or provider availability.
- Keep route and persistence changes covered by focused tests.