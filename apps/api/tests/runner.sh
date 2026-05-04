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
# Lockfile hash 가 deps 이미지 태그. apps/api/Dockerfile 의 FROM 이 사용.
export DEPS_TAG=$(sha256sum "${MONO_DIR}/../../package-lock.json" | cut -c1-16)

# nginx:alpine, docker:cli 등 외부 이미지를 docker hub 직접 pull → 100/6h
# rate limit 가능. 첫 pull flake 흡수용 선형 백오프.
for attempt in 1 2 3 4 5; do
    REPLICAS="${REPLICAS:-4}" docker compose --env-file "$ENV_FILE" up -d --build && break
    echo "compose up failed (attempt $attempt); sleeping..."
    docker compose --env-file "$ENV_FILE" down -v -t 0 || true
    sleep $((attempt * 10))
    [ "$attempt" = 5 ] && { echo "compose up failed after 5 attempts"; exit 1; }
done
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
