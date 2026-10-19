# Code Review

Date: 2026-10-19
Scope: Full MVP codebase - backend (`backend/app/main.py`, tests), frontend (`frontend/src`), Docker packaging, and scripts.

## Summary

The MVP is complete and in good shape for its scope. Security fundamentals are handled correctly, the AI action pipeline is the best-engineered part of the codebase, and the Docker packaging is clean. The findings below are quality and consistency issues rather than blockers; none prevent the app from doing its job as a single-user local Kanban board.

## What is done well

- **Auth done properly for a demo**: PBKDF2 with 600k iterations, session tokens stored as SHA-256 hashes (revocable logout), HttpOnly + SameSite=strict cookies, `hmac.compare_digest` for verification, and a migration path for legacy plaintext rows.
- **AI action pipeline is robust**: strict Pydantic models with per-action field constraints (`BoardAction.validate_action_fields`), unknown-ID rejection, duplicate-action detection, and all-or-nothing application. The system prompt explicitly marks board data as untrusted. Malformed provider output returns 502 without touching the board.
- **Docker packaging**: multi-stage build, `uv sync --frozen`, non-root user, port bound to 127.0.0.1 only, named volume for the database.
- **Frontend hygiene**: no tokens in browser storage, same-origin `/api` calls, accessible markup (labels, `aria-live`, `role="log"`), clean component split.
- **Tests mock the provider** instead of depending on a live free-tier API, and cover auth, persistence, and all four AI action types.

## Findings

### Medium

1. **Test hooks in production code** - `KanbanBoard.tsx:36` and `:52` check `process.env.NODE_ENV === "test"` to skip loading behavior. Application code should not know about the test runner. Stub `fetch` in the tests (already done elsewhere in `KanbanBoard.test.tsx`) and remove both checks.

2. **Column rename saves the full board on every keystroke** - `KanbanColumn.tsx:46` calls `onRename` on each `onChange`, and `handleRenameColumn` persists the entire board per keystroke. Save on blur or Enter, or debounce.

3. **`initialize_database()` runs on every API request** - called from `is_valid_session_token` (main.py:135), `fetch_board` (:314), `save_board` (:363), `login` (:511), and `logout` (:553). Every request executes roughly ten redundant `CREATE TABLE IF NOT EXISTS` / seed-check queries. Initialize once at startup.

4. **SQLite connections are never closed** - `with get_connection() as connection` uses sqlite3's transaction context (commit/rollback), not a closing context. Connections linger until garbage collection. Use `contextlib.closing(get_connection())` or explicit `try/finally`.

5. **Blocking SQLite inside `async def` endpoints** - `get_board`, `put_board`, `login`, `logout`, and `auth_session` are `async def` performing synchronous database I/O on the event loop, while `ai_chat` and `ai_test` are correctly sync `def` (threadpool). Make the database-touching endpoints plain `def` for consistency.

### Low

6. **`BoardPayload` accepts untyped dicts** (main.py:38-40) - no field validation, unlike the strict AI path. A malformed payload raises `KeyError` in `save_board` (500 instead of 422), and title/details length is unbounded. Validate with typed models or add minimal checks.

7. **Expired sessions are never purged** - rows in `auth_sessions` accumulate forever. Delete expired rows during initialization.

8. **Redundant routes** - `POST /api/board` (main.py:590) duplicates `PUT /api/board`; nothing calls it. `GET /api/hello` (main.py:575) is scaffold leftover. Remove both.

9. **Full-board save race** - every mutation PUTs the entire board; rapid successive actions can overlap and persist stale state (last write wins). Acceptable for a single user; serialize saves if it ever matters.

10. **`save_board` resets `created_at` on every save** - delete-and-reinsert recreates rows with `datetime('now')` (main.py:373-392). Harmless today, misleading if `created_at` is ever used.

11. **No SQLite `busy_timeout` or WAL mode** (main.py:150-155) - concurrent writes can raise "database is locked". One PRAGMA each fixes it.

12. **AI can create whitespace-only card titles** - `BoardAction` requires a truthy title, but `.strip()` in `apply_ai_actions` (main.py:480, 487) can reduce it to an empty string. Strip inside the validator.

13. **Closing the chat sidebar wipes the conversation** - `KanbanBoard.tsx:290` unmounts `AIChatSidebar`, discarding message state. Keep it mounted and hidden, or lift the state.

14. **Card deletion has no confirmation** (KanbanCard.tsx:100-108) - one misclick permanently removes a card.

15. **Seed data duplicated** - `default_board()` (main.py:158) and `initialData` (kanban.ts:18) define the same eight cards in two places. Drift risk; consider generating one from the other or trimming the frontend copy to a minimal placeholder.

### Nits

- `cardsById` in `KanbanBoard.tsx:94` is a no-op `useMemo` (returns its own dependency).
- `void saveBoard(...)` is called inside `setBoard` updater functions (KanbanBoard.tsx:113, 126, 146, 167, 181). StrictMode double-invokes updaters in dev, causing duplicate PUTs (idempotent, but an anti-pattern).
- `createId` (kanban.ts:164) could be `crypto.randomUUID()`.
- Login timing differs for unknown username (skips PBKDF2) vs wrong password (main.py:513-518). Irrelevant for the hardcoded demo user.
- No `HEALTHCHECK` in the Dockerfile.
- `ai_chat` discards `save_board`'s return value and calls `fetch_board()` again (main.py:642-648); `save_board` already returns the fresh board.
- `fetch_board` builds column card lists by scanning all card rows per column - O(columns x cards), fine at this scale.

## Test coverage

- **Backend**: auth happy/reject paths, logout revocation, password hashing and plaintext migration, board persistence, AI status/connectivity/chat with all action types, invalid AI actions leaving the board untouched, malformed provider output. Gaps: expired-session behavior, `PUT /api/board` with a malformed payload, conflicting actions for one card (the `touched_card_ids` path), create into an unknown column.
- **Frontend**: `moveCard` logic and the key UI flows (login gate, add/edit/delete, AI reply applying a board). Gaps: save-failure banner, board load error and retry, drag-and-drop (Playwright covers this outside jsdom).

## Suggested priority

1. Remove the `NODE_ENV === "test"` checks from production code (finding 1).
2. Stop per-request database initialization and close connections properly (findings 3, 4).
3. Debounce or defer column-rename saves (finding 2).
4. Remove dead routes and purge expired sessions (findings 7, 8).
5. Everything else as convenient.
