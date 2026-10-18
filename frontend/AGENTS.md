# Frontend Agent Guide

This folder contains the Next.js frontend for the project management MVP. It statically exports the signed-in Kanban workspace and includes an AI chat sidebar, unit tests, and Playwright browser tests.

## Stack

- Next.js 16
- React 19
- TypeScript
- @dnd-kit for drag-and-drop interactions
- Vitest for unit tests
- Playwright for end-to-end tests
- Tailwind CSS via Next/PostCSS configuration

## Current implementation

The app uses server-backed authentication and board persistence. The main UI is centered in:

- src/app/page.tsx: login, session check, and logout
- src/components/KanbanBoard.tsx: board load/save states, board layout, drag/drop, and chat-sidebar toggle
- src/components/KanbanColumn.tsx: column rendering and interactions
- src/components/KanbanCard.tsx: editable and draggable card component
- src/components/KanbanCardPreview.tsx: drag overlay preview
- src/components/NewCardForm.tsx: add-card form
- src/components/AIChatSidebar.tsx: conversation UI and assistant response handling
- src/lib/kanban.ts: board state logic and helper functions

## Current behaviors

- The app shows five fixed kanban columns.
- Cards can be dragged between columns and within a column.
- Column titles are editable.
- New cards can be added to a column.
- Cards can be edited and deleted.
- Board state loads from and saves to the authenticated backend.
- AI responses can update the visible board after the backend validates and persists the actions.
- Initial board data is seeded with example cards and tasks.

## Testing setup

- Unit tests live alongside the logic and component tests.
- Test setup is in src/test/setup.ts.
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
- Treat the demo board as the starting point for the production app, not as a final implementation.
- Use same-origin `/api` routes; do not store authentication tokens in browser storage.
- Show loading, retry, and save-failure feedback instead of treating seed data as persisted data.

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
