#!/usr/bin/env bash
# API 테스트 스택 기동, theater 시드, 혼합 성능 측정과 정리를 한 번에 실행한다.
# 결과는 tests/api/benchmark/_output/에 남는다 — 집계 JSON과 dashboard-*.html(시간축 추이).
# 시드한 theaters는 인프라 Mongo에 남는다. 지우려면 bash infra/reset.sh를 실행한다.
#
# 사용: bash tests/api/benchmark/runner.sh
#   재정의: SEED_TARGET=10000 DURATION_MS=10000 bash tests/api/benchmark/runner.sh

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"
# shellcheck source=../../../.env.seed
. "${WORKSPACE_ROOT}/.env.seed"

# infra compose와 docker network를 공유하므로 docker compose가 infra 컨테이너를 orphan으로 표시한다.
# 의미적으로 별개의 묶음이라 경고만 끈다.
export COMPOSE_IGNORE_ORPHANS=True

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="${WORKSPACE_ROOT}/tests/api"
K6_RUNNER="${SCRIPT_DIR}/run-k6.sh"

# devcontainer는 API 테스트 스택과 같은 Docker 네트워크에 붙어 있어 서비스 이름으로 직접 접근한다.
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

echo "Building 4-replica api test stack..."
# EXIT trap이 곧 컨테이너를 지우므로, 기동 실패의 원인은 여기서 남기지 않으면 영구 소실된다.
if ! docker compose up -d --build --wait; then
    echo "[FAIL] compose up failed"
    dump_diagnostics
    exit 1
fi

# Restate를 직접 쓰지 않는 benchmark 실행도 같은 endpoint 등록 상태로 검증한다.
docker compose run --rm --no-deps restate-register

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

# theaters 생성은 admin 전용이므로 infra/reset.sh가 만든 고정 개발 fixture로 로그인한다.
login_admin() {
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
        "${K6_RUNNER}" run --quiet \
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

login_admin
seed_theaters

# ADMIN_ACCESS_TOKEN은 export되어 mixed-runner의 쓰기 레그까지 전달된다.
SERVER_URL="${SERVER_URL}" bash "${SCRIPT_DIR}/mixed-runner.sh"
