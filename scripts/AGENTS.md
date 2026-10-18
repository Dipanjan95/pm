# Scripts Agent Guide

This folder contains the local runtime start and stop scripts for the project.

## Files

- start.sh: Linux/macOS startup script using docker compose.
- stop.sh: Linux/macOS shutdown script using docker compose.
- start.ps1: Windows PowerShell startup script.
- stop.ps1: Windows PowerShell shutdown script.

## Intended behavior

Each script should:

- move to the repository root,
- run docker compose up --build -d for startup,
- or run docker compose down --remove-orphans for shutdown.

## Notes

- The project expects Docker Desktop or Docker Engine to be available.
- Set OPENROUTER_API_KEY in the root .env to enable AI. The app can start without a .env file; AI endpoints remain unavailable until the key is configured.
- Use the shell scripts to start and stop the app consistently across local environments.