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

# lockfile + deps.Dockerfile 합본 hash 가 deps 이미지 태그. main Dockerfile
# 의 FROM 이 이걸 사용. build-deps-image.yaml workflow 가 둘 중 하나라도
# 변경되면 ghcr 에 publish. compose 가 build args 로 인터폴레이션.
export DEPS_TAG=$(cat "${REPO_ROOT}/package-lock.json" "${REPO_ROOT}/apps/api/deps.Dockerfile" | sha256sum | cut -c1-16)

# 로컬 실행 fallback: ghcr 에 해당 tag 가 없거나 (lockfile/deps.Dockerfile 을
# 로컬에서만 수정한 상태) ghcr 인증이 안 된 경우에도 동작하도록, pull 실패 시
# deps.Dockerfile 로 직접 빌드해 같은 tag 로 로컬에 둔다. compose build 의
# FROM 은 로컬 캐시 hit → registry 접근 없이 그대로 사용.
DEPS_IMAGE="ghcr.io/mannercode/nest-seed/api-deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    if ! docker pull "$DEPS_IMAGE" 2>/dev/null; then
        echo "Deps image not in ghcr (or no auth); building locally."
        docker build \
            -f "${REPO_ROOT}/apps/api/deps.Dockerfile" \
            -t "$DEPS_IMAGE" \
            "${REPO_ROOT}"
    fi
fi

docker compose --env-file "$ENV_FILE" up -d --build
docker wait api-setup && docker rm api-setup

bash "${APP_DIR}/specs/run.sh"
