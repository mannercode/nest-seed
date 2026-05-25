#!/usr/bin/env bash
set -euo pipefail

: "${WORKSPACE_ROOT:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORKSPACE_ROOT}/apps/api"
cd "$SCRIPT_DIR"

ENV_FILE="${APP_DIR}/.env"

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

# api-docs/.env가 ROOT_PASSWORD를 fail-fast로 요구한다. host shell에 export해 둔다.
set -a
. "$ENV_FILE"
set +a

SERVER_URL=http://nginx:80 bash "${APP_DIR}/api-docs/run.sh"
