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

# 긴 stress 실행에서 temporal-postgresql / mongo 가 무한정 커지지 않도록
# RESET_EVERY iter 마다 infra (mongo/redis/temporal/...) 를 reset 한다.
# 이게 없으면 완료된 Temporal workflow history 가 수백 iter 에 걸쳐 쌓여
# 결국 transfer-queue-processor 가 stall 한다. 비용: reset 당 ~30s,
# 10 iter 당 한 번이면 overhead 5% 이내.
RESET_EVERY="${RESET_EVERY:-10}"
RESET_SCRIPT="$(cd "$(dirname "$0")/../../.devcontainer/infra" && pwd)/reset.sh"

for ((i = 1; i <= repeat_count; i++)); do
    echo "[Run ${i}/${repeat_count} | $(($(date +%s) - start_ts))s]"
    if [ "${i}" -gt 1 ] && [ $(((i - 1) % RESET_EVERY)) -eq 0 ] && [ -x "${RESET_SCRIPT}" ]; then
        echo "[reset infra @ iter ${i}]"
        bash "${RESET_SCRIPT}"
    fi
    "$@"
done
