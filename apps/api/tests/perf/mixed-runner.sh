#!/usr/bin/env bash
# API stack 용 mixed read/write workload matrix.
#
# 각 케이스는 theater-read와 theater-write 프로세스를 (거의) 동시에 시작해 측정 창을
# 공유시킵니다. 같은 LABEL을 쓰므로 결과 JSON을 사후에 짝지을 수 있습니다.
#
# Prereq: API stack 가동 중 (REPLICAS=8 권장), theaters가 seed 돼 있어야 함 (~50K+).
#
# Usage: bash apps/api/tests/perf/mixed-runner.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS="${SCRIPT_DIR}/harness.js"

DURATION_MS="${DURATION_MS:-30000}"
WARMUP_MS="${WARMUP_MS:-3000}"

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
        SCENARIO=theater-read CONCURRENCY="$read_c" \
            DURATION_MS="$DURATION_MS" WARMUP_MS="$WARMUP_MS" \
            LABEL="$label" node "$HARNESS" &
        pids+=("$!")
    fi
    if [ "$write_c" -gt 0 ]; then
        SCENARIO=theater-write CONCURRENCY="$write_c" \
            DURATION_MS="$DURATION_MS" WARMUP_MS="$WARMUP_MS" \
            LABEL="$label" node "$HARNESS" &
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
