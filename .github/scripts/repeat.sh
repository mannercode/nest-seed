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
        docker logs --tail 500 "${id}"
    done
}
trap on_failure ERR

start_ts=$(date +%s)

for ((i = 1; i <= repeat_count; i++)); do
    echo "[Run ${i}/${repeat_count} | $(($(date +%s) - start_ts))s]"
    "$@"
done
