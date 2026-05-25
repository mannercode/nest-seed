#!/usr/bin/env bash
set -euo pipefail

: "${WORKSPACE_ROOT:?}"

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끄고 reap은 하지 않는다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORKSPACE_ROOT}/apps/api"
cd "$SCRIPT_DIR"

cleanup() {
    docker compose down -v -t 0
}
trap cleanup EXIT

. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

docker compose up -d --build --wait

SERVER_URL=http://nginx:80 bash "${APP_DIR}/api-docs/run.sh"
