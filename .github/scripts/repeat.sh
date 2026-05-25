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

# 부하 테스트를 오래 돌리면 Temporal의 PostgreSQL과 MongoDB 데이터가 계속 커진다.
# `RESET_EVERY` 회차마다 Mongo, Redis, Temporal을 초기화해 기록 누적을 막는다.
# 초기화하지 않으면 완료된 워크플로우 기록이 수백 회차 동안 쌓여 transfer-queue-processor가 멈출 수 있다.
# 초기화 한 번은 약 30초 걸린다.
RESET_EVERY="${RESET_EVERY:-10}"
RESET_SCRIPT="${WORKSPACE_ROOT:?WORKSPACE_ROOT must be set}/infra/reset.sh"

for ((i = 1; i <= repeat_count; i++)); do
    echo "[Run ${i}/${repeat_count} | $(($(date +%s) - start_ts))s]"
    if [ "${i}" -gt 1 ] && [ $(((i - 1) % RESET_EVERY)) -eq 0 ] && [ -x "${RESET_SCRIPT}" ]; then
        echo "[reset infra @ iter ${i}]"
        bash "${RESET_SCRIPT}"
    fi
    "$@"
done
