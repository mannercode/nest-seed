#!/usr/bin/env bash
# 분산 레이스 시나리오를 1회씩 순차 실행한다. 회귀 검출용 smoke이며,
# test-stability 워크플로처럼 반복 검증은 하지 않는다. WORKSPACE_ROOT는
# devcontainer가 세팅하고, 각 시나리오는 자기 compose stack을 띄웠다가 내린다.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

SCENARIOS=(
    sse
    user-race
    ticket-holding-race
    showtime-overlap-race
    purchase-double-spend
    replica-chaos
    jwt-refresh-race
)

for scenario in "${SCENARIOS[@]}"; do
    bash "${SCRIPT_DIR}/runner.sh" "$scenario"
done
