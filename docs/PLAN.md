# Project Execution Plan

This document breaks the project into implementation phases with explicit checklists, validation, and completion criteria. Each phase should be completed before moving to the next one.

## Implementation Status

All project parts are implemented and verified, including the Part 11 multi-user and multi-board expansion. The Docker image builds and runs as a non-root user, board and chat data survive a container restart, and live OpenRouter requests using the configured model succeed.

## Settled Product, Technical, and Visual Decisions

- **Product scope:** The app supports registered accounts (username 3+ characters, password 8+ characters) plus the seeded demo user. Each user owns multiple boards: create, rename, switch, and delete are supported, and new boards start with five columns (Backlog, Discovery, In Progress, Review, Done). Cards carry an optional due date, highlighted when overdue. The backend verifies credentials, issues expiring HttpOnly, SameSite-strict sessions stored as hashes so logout can revoke them, and scopes every board and chat route to the owning user.
- **Runtime:** The frontend is a statically exported Next.js app served at `/` by the FastAPI backend. The app runs in one local Docker container, uses `uv` for Python dependencies, and stores data in SQLite, initialized automatically when needed. Start and stop scripts are provided for Windows, macOS, and Linux.
- **AI:** Backend AI calls use OpenRouter with `liquid/lfm-2.5-2.6b:free`. `OPENROUTER_API_KEY` is supplied through the project-root `.env`. AI requests include the current board and conversation context; structured responses may include validated board changes.
- **Visual direction:** Keep the existing Kanban Studio direction: Space Grotesk for display text and Manrope for body text. The palette is accent yellow `#ecad0a`, primary blue `#209dd7`, secondary purple `#753991`, dark navy `#032147`, and gray `#888888` for supporting text.

These decisions are reflected in the root `AGENTS.md`, `docs/DATABASE_APPROACH.md`, `docs/database-schema.json`, and the current frontend implementation. Update this section when a decision is explicitly changed.

## Part 1: Planning and project onboarding

### Checklist

- [x] Confirm project scope, constraints, and delivery order from the root AGENTS.md and product brief.
- [x] Review the existing frontend app and document its current architecture in the frontend AGENTS.md file.
- [x] Capture the work breakdown in this plan with explicit substeps, tests, and success criteria.
- [x] Confirm the plan with the user before starting implementation.

### Verification

- The repo contains a clear implementation roadmap.
- The frontend AGENTS.md file accurately describes the current starter app.
- The user has reviewed and approved the plan.

### Success criteria

- The team has a single source of truth for execution order.
- Future changes are grounded in the current frontend state and project constraints.
- There is no ambiguity about the MVP feature set or technical decisions.

---

## Part 2: Scaffolding and local runtime foundation

### Goal

Set up the dockerized local runtime, create the FastAPI backend, and establish start/stop scripts that prove the app is serving a basic hello world page and a simple backend API response.

### Checklist

- [x] Create the Docker configuration for the app stack.
- [x] Create the backend/ service with FastAPI.
- [x] Add a minimal app root route that returns a simple HTML page or hello-world response.
- [x] Add an API route such as /api/health or /api/hello that returns a JSON payload.
- [x] Configure static frontend serving from FastAPI for the future production flow.
- [x] Add scripts/ start and stop utilities for Mac, Windows, and Linux.
- [x] Validate the container and local runtime start successfully.
- [x] Confirm the frontend route and backend API respond through the Docker runtime.

### Test strategy

- Smoke test the backend route directly.
- Smoke test the frontend home route once the app is served.
- Check local container behavior and startup logs.

### Success criteria

- The app can be started locally with scripts.
- A browser can load the root route.
- The backend health/hello API returns a valid JSON response.
- The project is ready to integrate the real frontend and application logic.

---

## Part 3: Frontend integration and static serving

### Goal

Integrate the existing frontend demo so it is built and served by the app. The Kanban board must render at / with full board behavior and the app must work as a static production-ready frontend.

### Checklist

- [x] Confirm the Next.js app builds correctly in production mode.
- [x] Update the app to work as a static build served by the backend.
- [x] Verify the root route renders the Kanban board at /.
- [x] Preserve drag-and-drop and add card editing.
- [x] Run unit tests for board logic and component behavior.
- [x] Run browser-level checks for the home page and key interactions.

### Test strategy

- Vitest unit tests for board state transitions.
- Playwright tests for page render and key interactions.
- Production build validation with next build.

### Success criteria

- The homepage shows the Kanban board without requiring demo-only local frontend runtime.
- The app can be served from the backend stack.
- Board interactions still work after integration.
- No broken frontend regressions are introduced.

---

## Part 4: Fake authentication flow

### Goal

Require a simple sign-in experience before the Kanban is visible. Only authorized users can access the board.

### Checklist

- [x] Add a login screen and route gating to /.
- [x] Support dummy credentials: user / password.
- [x] Allow authenticated users to access the Kanban board.
- [x] Add logout flow with server-side session revocation.
- [x] Block access to the board for unauthenticated visitors.
- [x] Ensure sign-in state resets appropriately on logout.
- [x] Test both happy-path and rejection-path cases.

### Test strategy

- Unit tests for login state and guard behavior.
- Integration tests for unauthenticated blocking and valid login flow.
- UI tests verifying logout transitions.

### Success criteria

- Users must log in before seeing the board.
- Dummy credentials work exactly as designed.
- Logged-out users cannot interact with the board.
- The user experience matches the MVP requirements.

---

## Part 5: Database modeling and schema proposal

### Goal

Define the persistence structure for the Kanban board and document the schema for future implementation. This should be reviewed before backend API work begins.

### Checklist

- [x] Define a Kanban data schema for users, sessions, boards, columns, cards, and future chat history.
- [x] Save the schema as a JSON document in docs/.
- [x] Document the database approach and assumptions in a short design note.
- [x] Include how future multi-user support will fit into the schema.
- [x] Validate that the schema supports board state, card movement, column renames, and user isolation.
- [x] Get user sign-off before API development begins.

### Test strategy

- Review persistence assumptions against the existing frontend model.
- Verify schema supports required MVP features and future extension.

### Success criteria

- Database design is explicit and stable.
- The schema matches the actual frontend board model.
- User sign-off is recorded before implementation continues.

---

## Part 6: Backend persistence and API routes

### Goal

Add backend routes to read and update the Kanban for a signed-in user; ensure the database is created automatically if it does not exist.

### Checklist

- [x] Create the SQLite database layer and initialization logic.
- [x] Define the schema and migration/init path for a fresh DB, including legacy password migration.
- [x] Add authenticated API routes for loading board data.
- [x] Add API routes for updating board structure and card state.
- [x] Add API routes for renaming columns and modifying card data.
- [x] Add backend tests for main API operations.
- [x] Validate database creation and persistence across requests.

### Test strategy

- Unit tests for database initialization and CRUD behavior.
- API tests covering successful reads/writes and edge cases.
- Data integrity checks after move, rename, and add/delete actions.

### Success criteria

- API routes perform valid board reads and writes.
- Database creation works automatically.
- Data persists correctly across backend calls.
- Core Kanban operations are covered by automated tests.

---

## Part 7: Frontend-to-backend integration

### Goal

Replace the client-only board state with real backend-backed persistence so the app behaves like a persistent Kanban board.

### Checklist

- [x] Connect the frontend UI to the backend API for board loading.
- [x] Replace local demo state with API-driven state updates.
- [x] Support creating, editing, moving, renaming, and deleting cards through the backend.
- [x] Handle loading, retry, and save-error states.
- [x] Ensure auth and board selection are aligned with the signed-in user.
- [x] Run frontend and API tests for integration behavior.

### Test strategy

- End-to-end tests for loading board data and making updates.
- API integration tests for synchronized state.
- Regression tests for drag and drop and editing flows.

### Success criteria

- The board reflects real persisted data.
- User actions update the server state and UI consistently.
- App behavior is reliable across multiple interactions.

---

## Part 8: AI connectivity

### Goal

Wire the backend to OpenRouter and validate that AI connectivity works with a simple prompt such as 2 + 2.

### Checklist

- [x] Add OpenRouter configuration and environment handling.
- [x] Keep the API key under the project root .env pattern as specified.
- [x] Create a backend AI endpoint for connectivity testing.
- [x] Send a live sample prompt and verify a successful response.
- [x] Confirm the backend can reach the configured model and parse the live reply.
- [x] Add mocked tests proving provider request and response handling.

### Test strategy

- Unit/API test for a basic AI call.
- Manual verification with a simple arithmetic prompt.

### Success criteria

- OpenRouter calls succeed with the configured model.
- AI response handling is robust and testable.
- The backend is ready for AI-driven board operations.

---

## Part 9: Structured AI board operations

### Goal

Give the AI access to the current Kanban JSON plus the user's request and chat history. The AI must respond in structured output that can include a natural-language answer and optional board changes.

### Checklist

- [x] Build the AI request payload with board JSON and user context.
- [x] Include bounded conversation history in the prompt.
- [x] Define the structured response contract for user reply and optional board updates.
- [x] Validate the backend can parse and enforce the response schema.
- [x] Allow validated card creation, updates, deletions, and moves.
- [x] Test valid and invalid AI payloads.
- [x] Validate known IDs, supported operations, conflicts, and all-or-nothing application.

### Test strategy

- Unit tests for prompt composition.
- API tests for structured outputs.
- Negative tests for malformed AI responses.

### Success criteria

- AI responses are structured and machine-readable.
- The backend can safely apply allowed board changes.
- Board actions are predictable and test-verified.

---

## Part 10: AI chat sidebar and automatic UI refresh

### Goal

Add a polished chat sidebar that lets the user interact with the AI and automatically refreshes the Kanban when AI-driven updates are applied.

### Checklist

- [x] Build the AI chat sidebar UI.
- [x] Send user questions to the backend AI endpoint.
- [x] Display the conversation history and AI responses.
- [x] Support validated AI-proposed board updates.
- [x] Refresh the frontend from the persisted board returned by the backend.
- [x] Keep the UI aligned with the product design.
- [x] Validate interactive behavior through unit and browser tests.

### Test strategy

- Browser tests for sending chat messages and seeing AI responses.
- Tests for AI-driven board update propagation.
- Regression tests for the board refresh flow.

### Success criteria

- Users can chat with the AI in a sidebar.
- AI updates can modify the Kanban board.
- The frontend refreshes automatically and remains in sync with backend state.
- The app meets the MVP feature requirements.

---

## Definition of done for the full project

The MVP is complete when all phases above are checked off and the following are true:

- [x] The app supports local sign-in using user / password.
- [x] The signed-in user sees a persistent Kanban board.
- [x] Board actions save reliably and failures are shown.
- [x] The backend and database work correctly in a locally started Docker deployment.
- [x] Live OpenRouter chat answers questions, leaves the board unchanged when requested, and applies explicitly requested structured actions.
- [x] The UI includes an AI chat sidebar and refreshes after AI board updates.
- [x] Tests cover the main user flows and backend behavior.

---

## Part 11: Multi-user and multi-board expansion

### Goal

Move beyond the single hardcoded MVP account: registration for new users, multiple boards per user with full CRUD, due dates on cards, per-board persisted AI chat history, and stronger coverage across both stacks.

### Checklist

- [x] Add POST /api/auth/register with validation, a default board per new user, and auto-login; scope all board and AI routes to the owning user.
- [x] Replace the legacy /api/board routes with RESTful /api/boards CRUD (list, create, detail, rename, full-state save, cascade delete).
- [x] Add cards.due_date with a startup migration for existing databases; tighten board payload models.
- [x] Persist AI conversations per board (chat_messages table) and replay them as provider context; serve GET /api/boards/{id}/messages.
- [x] Frontend: registration flow, Workspace component with board switcher/rename/delete/create, per-board KanbanBoard keyed remount.
- [x] Frontend: due dates on card forms and cards, overdue highlighting, AIChatSidebar loading persisted history.
- [x] Column renames commit on blur/Enter instead of saving per keystroke; state loads without seed fixtures; deleted dead routes.
- [x] Backend tests reorganized (serving, auth, boards, migrations, AI) with pytest-cov; frontend unit and Playwright suites updated.

### Verification

- Backend: 50 pytest tests pass with 100% line coverage on app/main.py.
- Frontend: 48 Vitest tests pass with ~90% coverage; eslint clean; static export builds.
- E2E: 8 Playwright tests pass (load, add card with due date, board switch, create, delete with confirm, drag, AI chat with history, registration).
- Live smoke through the rebuilt container: demo migration intact, register, cross-user 404s, due-date round-trip, rename, delete cascade, logout revocation, live AI chat and a live AI card creation.

### Success criteria

- Users can register, own private boards, and never see another user's board.
- Board state, due dates, and chat history survive restarts in the existing volume.
- All previously working flows (drag, edit, AI actions) still pass their suites.
