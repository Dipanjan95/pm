# The Project Management MVP web app

## Business Requirements

This project is building a Project Management App. Key features:
- A user can sign in or register a new account (per-user accounts, hashed passwords)
- When signed in, the user sees a Kanban board representing their project
- A user can create, rename, switch between, and delete multiple Kanban boards
- The Kanban board has fixed columns that can be renamed
- The cards on the Kanban board can be moved with drag and drop, and edited; cards can carry an optional due date, highlighted when overdue
- There is an AI chat feature below the board; the AI is able to create / edit / move one or more cards, and the conversation is persisted per board

## Limitations

There is a seeded demo account (`user` / `password`) kept for backwards compatibility; registered users are regular accounts with no roles or sharing.
Each user has their own private boards; there is no team/workspace sharing.
For the MVP, this will run locally (in a docker container)

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. Set OPENROUTER_API_KEY in the root .env to enable them; the local app can run without it, with AI endpoints disabled.
- Use `liquid/lfm-2.5-2.6b:free` as the model
- Use SQLLite local database for the database, creating a new db if it doesn't exist
- Start and Stop server scripts for Mac, PC, Linux in scripts/

## Starting Point

A working MVP of the frontend has been built and is already in frontend. This is not yet designed for the Docker setup. It's a pure frontend-only demo.

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

All documents for planning and executing this project will be in the docs/ directory.
Please review the docs/PLAN.md document before proceeding.