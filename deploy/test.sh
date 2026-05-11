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

# api 컨테이너가 infra (mongo/redis/...) 와 같은 네트워크에 join 해야 한다.
# devcontainer postStart 에서 reset.sh 가 만들어두지만 멱등 보장.
docker network create nest-seed-infra 2>/dev/null || true

# api image 도 dod 격리상 stdin tar context 로 직접 build (compose 의 build:
# context 는 호스트 경로를 요구해 빠졌다). tag 만 만들어두면 compose 가 image:
# 로 참조한다.
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

# dod 환경에선 devcontainer 의 localhost 가 nginx 컨테이너로 안 닿고
# (sibling container, host port 매핑은 호스트 자체의 포트), 같은 nest-seed
# 네트워크의 service name 으로만 도달. api-docs/.env 의 default
# SERVER_URL=http://localhost:3000 을 nginx:80 으로 override.
SERVER_URL=http://nginx:80 bash "${APP_DIR}/api-docs/run.sh"
