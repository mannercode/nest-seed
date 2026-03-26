#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <repeat-count> <command> [args...]" >&2
    exit 2
fi

repeat_count="$1"
shift

if ! [[ "${repeat_count}" =~ ^[0-9]+$ ]] || [ "${repeat_count}" -le 0 ]; then
    echo "repeat-count must be a positive integer: ${repeat_count}" >&2
    exit 2
fi

dump_compose_logs () {
    docker ps -a || true
    docker stats -a --no-stream

    for id in $(docker ps -aq); do
        echo "========================= ${id} ========================="
        docker logs "${id}" || true
    done
}

trap 'rc=$?; if [ ${rc} -ne 0 ]; then dump_compose_logs; fi; exit ${rc}' EXIT

start_ts=$(date +%s)

for ((i = 1; i <= repeat_count; i++)); do
    elapsed=$(($(date +%s) - start_ts))
    printf '[Run %d/%d | Elapsed %02d:%02d:%02d]\n' "${i}" "${repeat_count}" $((elapsed/3600)) $(((elapsed%3600)/60)) $((elapsed%60))
    "$@"
done
