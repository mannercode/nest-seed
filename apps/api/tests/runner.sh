#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_DIR="${MONO_DIR}/deploy"

TEST_NAME="${1:?Usage: $0 <test-name>}"
TEST_SCRIPT="${SCRIPT_DIR}/${TEST_NAME}.js"

if [ ! -f "$TEST_SCRIPT" ]; then
    echo "Error: no test script at ${TEST_SCRIPT}"
    exit 1
fi

cd "$COMPOSE_DIR"

ENV_FILE="${ENV_FILE:-${MONO_DIR}/.env}"
LISTEN_PORT="${LISTEN_PORT:-3000}"
SERVER_URL="http://localhost:${LISTEN_PORT}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

cleanup() {
    echo ""
    echo "Tearing down..."
    docker compose --env-file "$ENV_FILE" down -v -t 0
}
trap cleanup EXIT

echo "Building and deploying 4-replica api stack..."
REPO_ROOT="$(cd "${MONO_DIR}/../.." && pwd)"

# lockfile + deps.Dockerfile 합본 hash 가 deps 이미지 태그. deploy/test.sh
# 와 동일 식이어야 함 — 한쪽만 바꾸면 ghcr tag mismatch.
export DEPS_TAG=$(cat "${REPO_ROOT}/package-lock.json" "${REPO_ROOT}/apps/api/deps.Dockerfile" | sha256sum | cut -c1-16)

# 로컬 실행 fallback: ghcr 미인증/태그 부재 시 deps.Dockerfile 로 직접 빌드해
# 같은 tag 로 로컬 캐시에 둔다. compose build 의 FROM 이 캐시 hit.
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

REPLICAS="${REPLICAS:-4}" docker compose --env-file "$ENV_FILE" up -d --build
docker wait api-setup && docker rm api-setup

echo ""
docker compose --env-file "$ENV_FILE" ps

echo ""
echo "=== ${TEST_NAME} ==="
if SERVER_URL="${SERVER_URL}" node "${TEST_SCRIPT}"; then
    echo "[PASS] ${TEST_NAME}"
    exit 0
fi

echo "[FAIL] ${TEST_NAME}"
echo ""
echo "=== container diagnostics ==="
docker compose --env-file "$ENV_FILE" ps -a || true
for cid in $(docker compose --env-file "$ENV_FILE" ps -aq 2>/dev/null); do
    cname=$(docker inspect --format '{{.Name}} ({{.State.Status}})' "$cid" 2>/dev/null || echo "$cid")
    echo "--- logs ${cname} (last 200) ---"
    docker logs --tail 200 "$cid" 2>&1 || true
    echo ""
done
exit 1
