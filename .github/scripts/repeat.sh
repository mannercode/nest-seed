#!/usr/bin/env bash
set -Eeuo pipefail

repeat_count="$1"
shift

on_failure () {
    docker ps -a
    docker stats -a --no-stream

    for id in $(docker ps -aq); do
        name=$(docker inspect --format '{{.Name}} ({{.State.Status}})' "${id}")
        echo "========================= ${name} ========================="
        docker logs --tail 200 "${id}"
    done
}
trap on_failure ERR

start_ts=$(date +%s)

# 부하 테스트를 반복하면 완료된 워크플로우 기록이 Temporal의 PostgreSQL과 MongoDB에 계속 쌓인다.
# 일정량을 넘으면 transfer-queue-processor가 멈춰 사가가 제때 끝나지 못한다.
# `RESET_EVERY` 회차마다 인프라를 초기화해(회당 약 30초) 누적을 막는다.
# 누적량은 회차 수가 아니라 회차당 생성 워크플로 수를 따르므로, 사가를 많이 만드는 시나리오는 이 값을 더 작게 넘긴다.
RESET_EVERY="${RESET_EVERY:-10}"
RESET_SCRIPT="${WORKSPACE_ROOT:?WORKSPACE_ROOT must be set}/infra/reset.sh"

for ((i = 1; i <= repeat_count; i++)); do
    echo "[Run ${i}/${repeat_count} | $(($(date +%s) - start_ts))s]"
    if [ "${i}" -gt 1 ] && [ $(((i - 1) % RESET_EVERY)) -eq 0 ]; then
        echo "[reset infra @ iter ${i}]"
        bash "${RESET_SCRIPT}"
    fi
    "$@"
done
