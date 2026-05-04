#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-../.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

cleanup() {
    docker compose --env-file "$ENV_FILE" down -v -t 0
}
trap cleanup EXIT

# Dockerfile 의 RUN --mount=type=cache,target=/root/.npm 가 1차 방어선.
# 같은 호스트에서 두 번째 빌드부터 npm install 이 캐시 hit → ECONNRESET 회피.
# CI 처럼 매번 fresh runner 인 환경에서는 BuildKit GHA cache backend 가
# 추가로 필요. ACTIONS_RUNTIME_TOKEN 이 set 되어 있을 때만 buildx bake 로
# GHA cache 와 통신해서 빌드, 아니면 (로컬 dev) 평범한 compose build.
if [ -n "${ACTIONS_RUNTIME_TOKEN:-}" ]; then
    docker buildx bake \
        --file "compose.yml" \
        --set "*.cache-from=type=gha,scope=api-build" \
        --set "*.cache-to=type=gha,scope=api-build,mode=max" \
        --load
    docker compose --env-file "$ENV_FILE" up -d --no-build
else
    docker compose --env-file "$ENV_FILE" up -d --build
fi
docker wait api-setup && docker rm api-setup

bash "${APP_DIR}/specs/run.sh"
