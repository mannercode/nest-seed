#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
cd .devcontainer/infra

# devcontainer.json 의 --env-file 캐시를 우회 — reset.sh 와 같은 이유.
set -a; source .env; set +a

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

docker compose up -d
docker wait infra-setup
docker rm infra-setup

cd "$ROOT"
npm test -w apps
