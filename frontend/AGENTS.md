# Frontend Agent Guide

This folder contains the Next.js frontend for the project management app. It statically exports the signed-in multi-board workspace with registration, per-user boards, due-dated cards, and a full-width AI chat panel, plus unit tests and Playwright browser tests.

## Stack

- Next.js 16
- React 19
- TypeScript
- @dnd-kit for drag-and-drop interactions
- Vitest for unit tests
- Playwright for end-to-end tests
- Tailwind CSS via Next/PostCSS configuration

## Current implementation

The app uses server-backed authentication (register + login) and per-user board persistence. The main UI is centered in:

- src/app/page.tsx: session check, sign-in and registration forms, logout
- src/components/Workspace.tsx: boards list, board switcher, rename/delete/new board, user chip, AI chat toggle
- src/components/KanbanBoard.tsx: per-board load/save states, column layout, drag/drop, and chat panel rendering
- src/components/KanbanColumn.tsx: column rendering, commit-on-blur title edits
- src/components/KanbanCard.tsx: editable and draggable card component with due date display and editing
- src/components/KanbanCardPreview.tsx: drag overlay preview
- src/components/NewCardForm.tsx: add-card form with optional due date
- src/components/AIChatSidebar.tsx: full-width chat panel that loads persisted history and handles assistant responses
- src/lib/api.ts: fetch wrapper that surfaces server error details
- src/lib/kanban.ts: board state types and helper functions (moveCard, isOverdue, createId)

## Current behaviors

- Users sign in or register; registration creates a default "Main Board" with five columns.
- The workspace lists all of the user's boards; users switch via a selector, rename via the title input, create, and delete boards (with confirmation).
- The board view shows the board's own fixed columns (newly created boards get Backlog, Discovery, In Progress, Review, Done).
- Cards can be dragged between columns and within a column.
- Column titles are editable and save on blur or Enter.
- New cards can be added to a column with an optional due date.
- Cards can be edited (title, details, due date) and deleted; overdue due dates are highlighted.
- Board state loads from and saves to the authenticated backend; failures show retry or save-error feedback.
- AI responses can update the visible board after the backend validates and persists the actions; chat history is persisted per board and loaded when the chat opens.

## Testing setup

- Unit tests live alongside the logic and component tests (src/lib, src/components, src/app).
- Test setup is in src/test/setup.ts; src/test/mockFetch.ts provides the route-stub helper used by component tests.
- The project scripts in package.json include:
  - npm run test:unit
  - npm run test:e2e
  - npm run test:all
  - npm run build
  - npm run lint

## Important conventions

- Keep the implementation simple and avoid unnecessary abstraction.
- Prefer small reusable components over large monolithic files.
- Preserve the existing app styling direction and color palette from the root project requirements.
- Use same-origin `/api` routes; do not store authentication tokens in browser storage.
- Show loading, retry, and save-failure feedback; never substitute seed fixtures for real board data.

## Working expectations

When modifying this folder:

1. Keep the frontend statically exportable and use the FastAPI same-origin routes for protected operations.
2. Add or update tests for behavior changes.
3. Prefer a minimal change set that aligns with the project roadmap.
4. Do not introduce Docker-specific or backend logic here unless the plan explicitly calls for it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
