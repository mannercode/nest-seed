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

# 부하 테스트를 길게 돌리면 Temporal 의 PostgreSQL 과 MongoDB 가 계속
# 부풀어 오른다. 그래서 `RESET_EVERY` 회차마다 한 번씩 인프라
# (mongo, redis, temporal 등) 를 reset 한다. 이걸 빼면 끝난 Temporal
# 워크플로우 기록이 수백 회차 동안 쌓여 결국 transfer-queue-processor
# 가 멈춰 버린다. reset 한 번은 약 30 초가 걸리고, 열 회차마다 한 번이면
# 전체 부하의 5% 안쪽에서 끝난다.
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
