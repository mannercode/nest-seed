#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${REPO_ROOT}/apps/api"
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
. "${REPO_ROOT}/ensure-deps-image.sh"

docker compose --env-file "$ENV_FILE" up -d --build
docker wait api-setup && docker rm api-setup

bash "${APP_DIR}/api-docs/run.sh"
