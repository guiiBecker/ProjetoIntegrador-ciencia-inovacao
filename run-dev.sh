#!/usr/bin/env bash
# Dev-mode wrapper: starts the stack with source code bind-mounted, running
# via ts-node / CRA dev server. No image rebuild needed after code edits —
# use `docker compose restart <service>` (backend/worker) to pick up changes.
# Frontend has hot reload out of the box.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.dev.yml)

case "${1:-up}" in
  up)
    docker compose "${COMPOSE_FILES[@]}" up -d "${@:2}"
    echo
    echo "Stack is up. Tailing logs (Ctrl+C to detach, containers keep running)."
    docker compose "${COMPOSE_FILES[@]}" logs -f
    ;;
  down)
    docker compose "${COMPOSE_FILES[@]}" down "${@:2}"
    ;;
  restart)
    docker compose "${COMPOSE_FILES[@]}" restart "${@:2}"
    ;;
  logs)
    docker compose "${COMPOSE_FILES[@]}" logs -f "${@:2}"
    ;;
  ps)
    docker compose "${COMPOSE_FILES[@]}" ps "${@:2}"
    ;;
  *)
    docker compose "${COMPOSE_FILES[@]}" "$@"
    ;;
esac
