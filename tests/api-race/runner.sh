#!/usr/bin/env bash
#
# 단일 race 시나리오를 실행하는 러너.
#
# 흐름:
#  1) deploy compose를 4-replica로 띄운다.
#  2) root Basic Auth로 시드 admin을 만든다.
#  3) 그 admin으로 로그인해 ADMIN_ACCESS_TOKEN을 받는다.
#  4) 시나리오 스크립트를 실행한다(이 토큰을 env로 받아 admin 보호 endpoint를 호출).
#  5) trap으로 deploy compose를 내린다(infra compose는 그대로).
#
# 사용: bash tests/api-race/runner.sh <scenario-name>
#  예) bash tests/api-race/runner.sh purchase-double-spend

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"
: "${ROOT_PASSWORD:?ROOT_PASSWORD must be set (devcontainer가 .env.api에서 inject)}"

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끈다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"

TEST_NAME="${1:?Usage: $0 <test-name>}"
TEST_SCRIPT="${SCRIPT_DIR}/${TEST_NAME}.js"

if [ ! -f "${TEST_SCRIPT}" ]; then
    echo "Error: no test script at ${TEST_SCRIPT}"
    exit 1
fi

cd "${COMPOSE_DIR}"

SERVER_URL="http://nginx"
ADMIN_EMAIL="seeded-admin@nest-seed.local"
ADMIN_PASSWORD="DevPass1!"
ADMIN_NAME="Seeded Admin"

cleanup() {
    echo ""
    echo "Tearing down..."
    docker compose down -v -t 0
}
trap cleanup EXIT

dump_diagnostics() {
    echo ""
    echo "=== container diagnostics ==="
    docker compose ps -a || true
    for cid in $(docker compose ps -aq 2>/dev/null); do
        cname=$(docker inspect --format '{{.Name}} ({{.State.Status}})' "${cid}" 2>/dev/null || echo "${cid}")
        echo "--- logs ${cname} (last 200) ---"
        docker logs --tail 200 "${cid}" 2>&1 || true
        echo ""
    done
}

bring_up_stack() {
    echo "Building and deploying 4-replica api stack..."
    . "${WORKSPACE_ROOT}/ensure-deps-image.sh"

    if ! docker compose up -d --build --wait; then
        echo "[FAIL] compose up failed before ${TEST_NAME} could start"
        dump_diagnostics
        exit 1
    fi

    echo ""
    docker compose ps
}

# admin은 API가 부팅 시 만들지 않는다. root Basic Auth로 직접 만들고 그 admin으로 로그인한다.
# 콘텐츠 endpoint(POST /movies, /theaters, /showtime-creation/*)는 admin token만 통과한다.
seed_admin_and_login() {
    local create_res
    create_res=$(curl -sS -X POST "${SERVER_URL}/admins" \
        -u "root:${ROOT_PASSWORD}" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"${ADMIN_NAME}\"}")
    if ! echo "${create_res}" | jq -e '.id' >/dev/null; then
        echo "Error: admin creation failed: ${create_res}"
        exit 1
    fi

    local login_res
    login_res=$(curl -sS -X POST "${SERVER_URL}/admins/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    ADMIN_ACCESS_TOKEN=$(echo "${login_res}" | jq -r '.accessToken // empty')
    if [ -z "${ADMIN_ACCESS_TOKEN}" ]; then
        echo "Error: admin login failed: ${login_res}"
        exit 1
    fi
    export ADMIN_ACCESS_TOKEN
}

run_scenario() {
    echo ""
    echo "=== ${TEST_NAME} ==="
    if SERVER_URL="${SERVER_URL}" node "${TEST_SCRIPT}"; then
        echo "[PASS] ${TEST_NAME}"
        return 0
    fi

    echo "[FAIL] ${TEST_NAME}"
    dump_diagnostics
    return 1
}

bring_up_stack
seed_admin_and_login
run_scenario
