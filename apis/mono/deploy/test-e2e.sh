#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

cleanup() {
    docker compose down -v -t 0
}
trap cleanup EXIT

docker compose --env-file ../.env up -d --build
docker wait api-setup && docker rm api-setup

bash api/run-all.sh
