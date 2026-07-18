#!/usr/bin/env bash
# API 스택용 읽기/쓰기 혼합 부하 행렬이다.
# theater-read와 theater-write가 측정 창과 LABEL을 공유하며 HTML 리포트를 `_output`에 남긴다.
# 실행 중인 스택, 약 50K 이상의 theater, ADMIN_ACCESS_TOKEN이 필요하다. 전체 수명주기는 runner.sh가 맡는다.
#
# 사용법: SERVER_URL=http://localhost:3000 bash tests/api-perf/mixed-runner.sh
#   재정의: DURATION_MS=60000 WARMUP_MS=5000 SERVER_URL=... bash tests/api-perf/mixed-runner.sh

set -euo pipefail

: "${WORKSPACE_ROOT:?}"
: "${SERVER_URL:?SERVER_URL must be set (예: SERVER_URL=http://localhost:3000 bash tests/api-perf/mixed-runner.sh)}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS="${SCRIPT_DIR}/harness-crud.js"

# 스택이 죽어 있으면 전체 행렬이 status 0 표본만 만들며 몇 분을 공회전한다. 시작 전에 끊는다.
if ! curl -fsS "${SERVER_URL}/health" >/dev/null; then
    echo "Error: ${SERVER_URL}/health 응답 없음 — 머리 주석의 스택 기동부터 확인한다"
    exit 1
fi

# k6는 handleSummary 반환 파일을 쓸 때 디렉토리는 만들지 않는다. 미리 만든다.
mkdir -p "${SCRIPT_DIR}/_output"

# 셸에서 기본값을 박지 않는다(이중 기본은 두 곳을 동시에 바꿔야 하는 함정).
# 호출자가 환경변수를 지정한 경우에만 --env로 k6에 넘겨준다.
extra_env=()
[ -n "${DURATION_MS:-}" ] && extra_env+=(--env "DURATION_MS=$DURATION_MS")
[ -n "${WARMUP_MS:-}" ] && extra_env+=(--env "WARMUP_MS=$WARMUP_MS")
[ -n "${ADMIN_ACCESS_TOKEN:-}" ] && extra_env+=(--env "ADMIN_ACCESS_TOKEN=$ADMIN_ACCESS_TOKEN")

# 러너가 케이스 중간에 끊겨도(한쪽 레그 실패, Ctrl-C) 남은 k6가 고아로 부하를 계속 걸지 않게 정리한다.
pids=()
cleanup() {
    for pid in "${pids[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
}
trap cleanup INT TERM EXIT

run_case() {
    local label="$1"
    local read_c="$2"
    local write_c="$3"

    echo
    echo "=========================================================="
    echo "CASE ${label}  read_c=${read_c}  write_c=${write_c}"
    echo "=========================================================="

    local stamp
    stamp="$(date +%Y%m%dT%H%M%S)"
    pids=()

    # 대시보드 포트는 레그별로 분리한다(동시 실행 시 bind 충돌 경고 방지).
    # 짧은 런에서 기본 집계 주기(10s)는 데이터 포인트가 서너 개뿐이라 2s로 줄인다.
    if [ "$read_c" -gt 0 ]; then
        K6_WEB_DASHBOARD=true \
            K6_WEB_DASHBOARD_PORT=5665 \
            K6_WEB_DASHBOARD_PERIOD=2s \
            K6_WEB_DASHBOARD_EXPORT="${SCRIPT_DIR}/_output/dashboard-${stamp}-${label}-read.html" \
            k6 run \
            --env "SERVER_URL=$SERVER_URL" \
            --env "SCENARIO=theater-read" \
            --env "CONCURRENCY=$read_c" \
            --env "LABEL=$label" \
            "${extra_env[@]}" \
            "$HARNESS" &
        pids+=("$!")
    fi
    if [ "$write_c" -gt 0 ]; then
        K6_WEB_DASHBOARD=true \
            K6_WEB_DASHBOARD_PORT=5666 \
            K6_WEB_DASHBOARD_PERIOD=2s \
            K6_WEB_DASHBOARD_EXPORT="${SCRIPT_DIR}/_output/dashboard-${stamp}-${label}-write.html" \
            k6 run \
            --env "SERVER_URL=$SERVER_URL" \
            --env "SCENARIO=theater-write" \
            --env "CONCURRENCY=$write_c" \
            --env "LABEL=$label" \
            "${extra_env[@]}" \
            "$HARNESS" &
        pids+=("$!")
    fi

    # 한쪽 레그가 실패해도 다른 쪽은 끝까지 기다려 요약을 확보하고, 실패는 모아서 전파한다.
    local status=0
    for pid in "${pids[@]}"; do
        wait "$pid" || status=$?
    done
    pids=()
    [ "$status" -eq 0 ] || return "$status"

    echo
    echo "--- settle 10s ---"
    sleep 10
}

run_case iso-r200 200 0
run_case iso-w100 0 100
run_case mixed-r100w50 100 50
run_case mixed-r100w100 100 100
run_case mixed-r200w50 200 50
run_case mixed-r200w100 200 100

echo
echo "=========================================================="
echo "DONE. results in tests/api-perf/_output/<scenario>-<ts>-<label>.json"
echo "      dashboards in tests/api-perf/_output/dashboard-<ts>-<label>-<leg>.html"
echo "=========================================================="
