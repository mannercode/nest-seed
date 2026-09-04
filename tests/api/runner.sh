#!/usr/bin/env bash
# 다중 API 복제본에서 실행 가능한 API 문서를 검증한다.
set -euo pipefail

: "${WORKSPACE_ROOT:?}"

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끄고 reap은 하지 않는다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORKSPACE_ROOT}/apps/api"
cd "$SCRIPT_DIR"

cleanup() {
    local exit_code=$?

    trap - EXIT
    set +e
    if [[ "${exit_code}" -ne 0 ]]; then
        docker compose ps --all >&2
        docker compose logs --no-color --timestamps >&2
    fi

    docker compose down -v -t 0
    exit "${exit_code}"
}
trap cleanup EXIT

docker compose up -d --build --wait
docker compose run --rm --no-deps restate-register

SERVER_URL=http://nginx bash "${APP_DIR}/api-docs/run.sh"
