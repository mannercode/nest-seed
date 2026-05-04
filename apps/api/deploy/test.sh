#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/../.." && pwd)"
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

# Lockfile hash 가 deps 이미지 태그. main Dockerfile 의 FROM 이 이걸 사용.
# build-deps-image.yaml workflow 가 lockfile 변경 시 ghcr 에 publish 하므로
# 이 시점엔 이미 존재. compose 가 build args 로 인터폴레이션.
export DEPS_TAG=$(sha256sum "${REPO_ROOT}/package-lock.json" | cut -c1-16)

docker compose --env-file "$ENV_FILE" up -d --build
docker wait api-setup && docker rm api-setup

bash "${APP_DIR}/specs/run.sh"
