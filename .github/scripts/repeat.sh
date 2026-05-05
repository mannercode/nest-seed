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

# Reset infra (mongo/redis/temporal/...) every RESET_EVERY iters to bound
# temporal-postgresql / mongo growth across long stress runs. Without
# this, completed Temporal workflow histories accumulate over hundreds
# of iters and the transfer-queue-processor eventually stalls. Cost:
# ~30s per reset, so once per 10 iters keeps overhead under 5%.
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
