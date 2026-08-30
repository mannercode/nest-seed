#!/usr/bin/env bash
# deploy 스택 기동, admin 인증, 단일 race 시나리오 실행, deploy 정리를 한 번에 수행한다.
# 사용: bash tests/api-race/runner.sh <scenario-name>
#  예) bash tests/api-race/runner.sh purchase-double-spend

set -Eeuo pipefail

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끈다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

list_scenarios() {
    echo "Scenarios:"
    for f in "${SCRIPT_DIR}"/*.js; do
        name="$(basename "$f" .js)"
        [ "$name" = "race-common" ] && continue
        echo "  $name"
    done
}

TEST_NAME="${1:-}"
if [ -z "${TEST_NAME}" ]; then
    echo "Usage: $0 <scenario>"
    list_scenarios
    exit 0
fi
TEST_SCRIPT="${SCRIPT_DIR}/${TEST_NAME}.js"

if [ ! -f "${TEST_SCRIPT}" ]; then
    echo "Error: no test script at ${TEST_SCRIPT}"
    list_scenarios
    exit 1
fi

: "${WORKSPACE_ROOT:?}"
: "${ROOT_PASSWORD:?ROOT_PASSWORD must be set (devcontainer가 .env.api에서 inject)}"
COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"

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
    local build_option="--build"
    if [ "${DEPLOY_IMAGES_PREBUILT:-false}" = "true" ]; then
        echo "Deploying prebuilt 4-replica api stack..."
        if ! docker image inspect nest-seed-api >/dev/null 2>&1; then
            echo "[FAIL] DEPLOY_IMAGES_PREBUILT=true but nest-seed-api is unavailable"
            exit 1
        fi
        build_option="--no-build"
    else
        echo "Building and deploying 4-replica api stack..."
    fi

    if ! docker compose up -d "${build_option}" --wait; then
        echo "[FAIL] compose up failed before ${TEST_NAME} could start"
        dump_diagnostics
        exit 1
    fi

    echo ""
    docker compose ps

    # Restate는 실행 endpoint를 자동 발견하지 않는다. AtoZ/Stability는 시작 전에
    # infra를 reset하므로 최초 등록되고, 같은 코드 반복은 기존 등록을 그대로 쓴다.
    docker compose run --rm --no-deps restate-register
}

# admin은 API가 부팅 시 만들지 않는다.
# root Basic Auth로 직접 만들고 그 admin으로 로그인한다.
# 콘텐츠 endpoint(POST /movies, /theaters, /showtime-creation/*)는 admin token만 통과한다.
# repeat.sh가 같은 시나리오를 여러 회 돌릴 때 mongo(infra)는 회차 간 살아 있어 1회차의 seed admin이 남는다.
# 그래서 2회차부터는 201 대신 409가 나오는데, 같은 패스워드로 로그인 결과는 동일하므로 둘 다 인정한다.
# 그 외 코드는 실제 오류로 본다.
seed_admin_and_login() {
    local create_body create_status
    create_body=$(mktemp)
    create_status=$(curl -sS -o "${create_body}" -w '%{http_code}' -X POST "${SERVER_URL}/admins" \
        -u "root:${ROOT_PASSWORD}" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"${ADMIN_NAME}\"}")
    if [ "${create_status}" != "201" ] && [ "${create_status}" != "409" ]; then
        echo "Error: admin creation returned HTTP ${create_status}: $(cat "${create_body}")"
        rm -f "${create_body}"
        # 이 실패 모드(부팅은 됐는데 인증 API가 이상)는 컨테이너 로그가 필요한 경우인데,
        # EXIT trap이 곧 컨테이너를 지우므로 여기서 남기지 않으면 영구 소실된다.
        dump_diagnostics
        exit 1
    fi
    rm -f "${create_body}"

    local login_res
    login_res=$(curl -sS -X POST "${SERVER_URL}/admins/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    ADMIN_ACCESS_TOKEN=$(echo "${login_res}" | jq -r '.accessToken // empty')
    if [ -z "${ADMIN_ACCESS_TOKEN}" ]; then
        echo "Error: admin login failed: ${login_res}"
        dump_diagnostics
        exit 1
    fi
    export ADMIN_ACCESS_TOKEN
}

run_scenario() {
    echo ""
    echo "=== ${TEST_NAME} ==="
    if SERVER_URL="${SERVER_URL}" node --test --test-reporter=spec "${TEST_SCRIPT}"; then
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
