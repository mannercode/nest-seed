#!/usr/bin/env bash
set -euo pipefail

: "${WORKSPACE_ROOT:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORKSPACE_ROOT}/apps/api"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

cleanup() {
    docker compose --env-file "$ENV_FILE" down -v -t 0
}
trap cleanup EXIT

. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

docker compose --env-file "$ENV_FILE" up -d --build --wait

SERVER_URL=http://nginx:80 bash "${APP_DIR}/api-docs/run.sh"
