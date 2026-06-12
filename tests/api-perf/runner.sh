#!/usr/bin/env bash
#
# 성능 측정을 한 번에 실행하는 러너.
#
# 흐름:
#  1) deploy compose를 4-replica로 띄운다.
#  2) theaters를 SEED_TARGET까지 시드한다(현재 수가 이미 충분하면 건너뛴다).
#  3) mixed-runner.sh로 읽기/쓰기 혼합 행렬을 측정한다.
#  4) trap으로 deploy compose를 내린다(infra compose는 그대로).
#
# 결과는 tests/api-perf/_output/에 남는다 — 집계 JSON과 dashboard-*.html(시간축 추이).
# 시드한 theaters는 인프라 Mongo에 남는다. 지우려면 bash infra/reset.sh를 실행한다.
#
# 사용: bash tests/api-perf/runner.sh
#   재정의: SEED_TARGET=10000 DURATION_MS=10000 bash tests/api-perf/runner.sh

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"
: "${ROOT_PASSWORD:?ROOT_PASSWORD must be set (devcontainer가 .env.api에서 inject)}"

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끈다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"

# devcontainer는 deploy compose와 같은 Docker 네트워크에 붙어 있어 서비스 이름으로 직접 접근한다.
# 호스트 포트(3000)는 기동 직후 공개가 늦을 수 있어 race 러너와 같은 방식을 쓴다.
SERVER_URL="http://nginx"
# 비인덱스 정규식 스캔 비용이 현실적으로 나오려면 표본이 이 정도는 있어야 한다.
SEED_TARGET="${SEED_TARGET:-50000}"

# k6는 handleSummary 결과 파일을 쓸 때 디렉토리를 만들지 않는다. 시드 단계부터 필요하므로 미리 만든다.
mkdir -p "${SCRIPT_DIR}/_output"

cd "${COMPOSE_DIR}"

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

echo "Building and deploying 4-replica api stack..."
. "${WORKSPACE_ROOT}/deploy/ensure-deps-image.sh"

# EXIT trap이 곧 컨테이너를 지우므로, 기동 실패의 원인은 여기서 남기지 않으면 영구 소실된다.
if ! docker compose up -d --build --wait; then
    echo "[FAIL] compose up failed"
    dump_diagnostics
    exit 1
fi

# compose up --wait가 돌아온 직후에는 nginx가 아직 첫 연결을 못 받을 수 있다. 상한을 두고 기다린다.
for i in {1..30}; do
    if curl -fsS "${SERVER_URL}/health" >/dev/null 2>&1; then
        break
    fi
    if [ "${i}" -eq 30 ]; then
        echo "Error: ${SERVER_URL}/health 응답 없음 — 스택이 떴는지 확인한다"
        exit 1
    fi
    sleep 1
done

theater_count() {
    curl -fsS "${SERVER_URL}/theaters?page=1&size=1" | jq -r '.total'
}

# theaters 생성은 admin 전용이다. race 러너와 같은 방식으로 root Basic Auth로 admin을 만들고 로그인한다.
# 반복 실행 시 1회차의 admin이 mongo에 남아 2회차부터 409가 나오는데, 로그인 결과는 같으므로 둘 다 인정한다.
seed_admin_and_login() {
    local create_status
    create_status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${SERVER_URL}/admins" \
        -u "root:${ROOT_PASSWORD}" \
        -H 'Content-Type: application/json' \
        -d '{"email":"seeded-admin@nest-seed.local","password":"DevPass1!","name":"Seeded Admin"}')
    if [ "${create_status}" != "201" ] && [ "${create_status}" != "409" ]; then
        echo "Error: admin creation returned HTTP ${create_status}"
        dump_diagnostics
        exit 1
    fi

    local login_res
    login_res=$(curl -sS -X POST "${SERVER_URL}/admins/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"seeded-admin@nest-seed.local","password":"DevPass1!"}')
    ADMIN_ACCESS_TOKEN=$(echo "${login_res}" | jq -r '.accessToken // empty')
    if [ -z "${ADMIN_ACCESS_TOKEN}" ]; then
        echo "Error: admin login failed: ${login_res}"
        dump_diagnostics
        exit 1
    fi
    export ADMIN_ACCESS_TOKEN
}

# theater-write 시나리오가 곧 시드 도구다(admin 토큰으로 POST /theaters를 부어 넣는다).
# 30초씩 부어 넣고 수를 다시 세서 목표 도달까지 반복한다. 수가 늘지 않는 비정상은 회수 상한으로 끊는다.
seed_theaters() {
    local count attempts=0
    count=$(theater_count)
    while [ "${count}" -lt "${SEED_TARGET}" ]; do
        attempts=$((attempts + 1))
        if [ "${attempts}" -gt 10 ]; then
            echo "Error: theaters ${count}/${SEED_TARGET} — 시드 10회로도 목표 미달이라 중단한다"
            exit 1
        fi
        echo "Seeding theaters... ${count}/${SEED_TARGET}"
        k6 run --quiet \
            --env "SERVER_URL=${SERVER_URL}" \
            --env "ADMIN_ACCESS_TOKEN=${ADMIN_ACCESS_TOKEN}" \
            --env "SCENARIO=theater-write" \
            --env "CONCURRENCY=100" \
            --env "DURATION_MS=30000" \
            --env "LABEL=seed" \
            "${SCRIPT_DIR}/harness-crud.js" >/dev/null
        count=$(theater_count)
    done
    echo "Theaters: ${count} (target ${SEED_TARGET})"
}

seed_admin_and_login
seed_theaters

# ADMIN_ACCESS_TOKEN은 export되어 mixed-runner의 쓰기 레그까지 전달된다.
SERVER_URL="${SERVER_URL}" bash "${SCRIPT_DIR}/mixed-runner.sh"
