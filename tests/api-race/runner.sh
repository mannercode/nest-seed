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

dump_diagnostics() {
    echo ""
    echo "=== container diagnostics ==="
    docker compose --env-file "$ENV_FILE" ps -a || true
    for cid in $(docker compose --env-file "$ENV_FILE" ps -aq 2>/dev/null); do
        cname=$(docker inspect --format '{{.Name}} ({{.State.Status}})' "$cid" 2>/dev/null || echo "$cid")
        echo "--- logs ${cname} (last 200) ---"
        docker logs --tail 200 "$cid" 2>&1 || true
        echo ""
    done
}

echo "Building and deploying 4-replica api stack..."
. "${WORKSPACE_ROOT}/ensure-deps-image.sh"

if ! REPLICAS="${REPLICAS:-4}" docker compose --env-file "$ENV_FILE" up -d --build --wait; then
    echo "[FAIL] compose up failed before ${TEST_NAME} could start"
    dump_diagnostics
    exit 1
fi

echo ""
docker compose --env-file "$ENV_FILE" ps

# race 시나리오의 setupFixture는 admin 보호 엔드포인트(POST /movies, /theaters, /showtime-creation/*)를 호출한다.
# dev seed admin으로 로그인해 토큰을 받아 환경변수로 전달한다(deploy compose는 NODE_ENV=production이지만 SEED_DEV_ADMIN=true가 같이 켜져 있어 시드가 생성된다).
LOGIN_RESPONSE=$(curl -sS -X POST "${SERVER_URL}/admins/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@nest-seed.local","password":"DevPass1!"}')
ADMIN_ACCESS_TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.accessToken // empty')
if [ -z "${ADMIN_ACCESS_TOKEN}" ]; then
    echo "Error: admin login failed: ${LOGIN_RESPONSE}"
    exit 1
fi
export ADMIN_ACCESS_TOKEN

echo ""
echo "=== ${TEST_NAME} ==="
if SERVER_URL="${SERVER_URL}" node "${TEST_SCRIPT}"; then
    echo "[PASS] ${TEST_NAME}"
    exit 0
fi

echo "[FAIL] ${TEST_NAME}"
dump_diagnostics
exit 1
