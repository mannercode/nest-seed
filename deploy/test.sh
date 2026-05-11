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

# shellcheck source=../ensure-deps-image.sh
. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

tar c \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='**/node_modules' \
    --exclude='**/_output' \
    --exclude='**/__tests__' \
    -C "${WORKSPACE_ROOT}" . | \
    docker build \
        -f apps/api/Dockerfile \
        --build-arg DEPS_TAG="${DEPS_TAG}" \
        -t api \
        -

docker compose --env-file "$ENV_FILE" up -d --wait

SERVER_URL=http://nginx:80 bash "${APP_DIR}/api-docs/run.sh"
