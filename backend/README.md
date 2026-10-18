# PM Backend

# PM Backend

FastAPI serves the static frontend, authenticated board API, and OpenRouter-backed assistant. SQLite initializes automatically in `data/project_management_mvp.db`.

Run backend tests from this directory with `uv run python -m pytest -q`. The app reads `OPENROUTER_API_KEY` from the environment; without it, AI routes return a configuration error while sign-in and board operations remain available.
