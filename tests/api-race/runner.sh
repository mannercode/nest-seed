#!/usr/bin/env bash
set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORKSPACE_ROOT}/apps/api"
COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"

TEST_NAME="${1:?Usage: $0 <test-name>}"
TEST_SCRIPT="${SCRIPT_DIR}/${TEST_NAME}.js"

if [ ! -f "$TEST_SCRIPT" ]; then
    echo "Error: no test script at ${TEST_SCRIPT}"
    exit 1
fi

cd "$COMPOSE_DIR"

ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
SERVER_URL="${SERVER_URL:-http://nginx}"

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
. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

REPLICAS="${REPLICAS:-4}" docker compose --env-file "$ENV_FILE" up -d --build --wait

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
