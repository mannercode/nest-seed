#!/usr/bin/env bash
# API 스택용 읽기/쓰기 혼합 부하 행렬이다.
#
# 각 케이스는 theater-read와 theater-write 프로세스를 (거의) 동시에 시작해 측정 창을 공유시킨다.
# 같은 LABEL을 쓰므로 결과 JSON을 사후에 짝지을 수 있다.
#
# 사전 조건: API 스택이 떠 있어야 한다(REPLICAS=8 권장).
# theaters도 미리 시드되어 있어야 한다(약 50K 이상).
#
# 사용법: bash tests/api-perf/mixed-runner.sh

set -euo pipefail

: "${WORKSPACE_ROOT:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS="${SCRIPT_DIR}/harness.js"

DURATION_MS="${DURATION_MS:-30000}"
WARMUP_MS="${WARMUP_MS:-3000}"

# k6는 handleSummary 반환 파일을 쓸 때 디렉토리는 만들지 않는다. 미리 만든다.
mkdir -p "${WORKSPACE_ROOT}/_output/perf"

run_case() {
    local label="$1"
    local read_c="$2"
    local write_c="$3"

    echo
    echo "=========================================================="
    echo "CASE ${label}  read_c=${read_c}  write_c=${write_c}"
    echo "=========================================================="

    local pids=()

    if [ "$read_c" -gt 0 ]; then
        k6 run \
            --env SCENARIO=theater-read \
            --env CONCURRENCY="$read_c" \
            --env DURATION_MS="$DURATION_MS" \
            --env WARMUP_MS="$WARMUP_MS" \
            --env LABEL="$label" \
            "$HARNESS" &
        pids+=("$!")
    fi
    if [ "$write_c" -gt 0 ]; then
        k6 run \
            --env SCENARIO=theater-write \
            --env CONCURRENCY="$write_c" \
            --env DURATION_MS="$DURATION_MS" \
            --env WARMUP_MS="$WARMUP_MS" \
            --env LABEL="$label" \
            "$HARNESS" &
        pids+=("$!")
    fi

    for pid in "${pids[@]}"; do
        wait "$pid"
    done

    echo
    echo "--- settle 10s ---"
    sleep 10
}

run_case iso-r200       200 0
run_case iso-w100       0   100
run_case mixed-r100w50  100 50
run_case mixed-r100w100 100 100
run_case mixed-r200w50  200 50
run_case mixed-r200w100 200 100

echo
echo "=========================================================="
echo "DONE. results in _output/perf/<scenario>-<ts>-<label>.json"
echo "=========================================================="
