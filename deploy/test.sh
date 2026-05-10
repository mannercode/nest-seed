#!/usr/bin/env bash
set -euo pipefail

: "${WORKSPACE_ROOT:?WORKSPACE_ROOT must be set (devcontainer 의 containerEnv 가 자동 주입)}"

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

# shellcheck source=../ensure-deps-image.sh
. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

docker compose --env-file "$ENV_FILE" up -d --build
docker wait api-setup && docker rm api-setup

bash "${APP_DIR}/api-docs/run.sh"
