#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
cd .devcontainer/infra

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

docker compose up -d
docker wait infra-setup
docker rm infra-setup

cd "$ROOT"
npm test -w apps
