# Database approach

This project uses SQLite as the local persistence layer for the MVP because it is simple to run inside the Docker container and does not require a separate database service.

## Why SQLite for the MVP

- Zero external service dependency
- Works well for single-user local development
- Easy to initialize automatically on first run
- Sufficient for the current board, card, and user model

## Schema strategy

The schema is organized around a simple set of entities:

- users: stores the signed-in user account
- auth_sessions: stores hashes of expiring server-side login tokens so logout can revoke sessions
- boards: stores the active board for a user
- board_columns: stores the fixed Kanban columns and their ordering
- cards: stores the Kanban cards, including column placement and order
- chat_messages: reserved for future AI conversation history

This keeps the model aligned with the existing frontend board object while leaving room for future multi-user and AI extension without breaking the current structure.

## MVP assumptions

- There is a single login credential pair: user / password
- Each user has one active board in the MVP
- Each board has five fixed columns: Backlog, Discovery, In Progress, Review, Done
- Dragging cards updates the card column and card position
- Column titles are editable by the user

## Future extension path

The model is intentionally future-ready:

- multiple users already have first-class storage
- multiple boards can be added per user without major schema change
- AI chat history can be stored without interfering with the board data model

## Sign-off note

The schema was reviewed as part of implementation and matches the persisted board, revocable authentication sessions, and future conversation-history model. Chat turns currently remain in the browser and are sent as bounded context with each AI request; they are not persisted in `chat_messages`.
