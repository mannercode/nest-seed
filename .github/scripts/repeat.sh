#!/usr/bin/env bash
set -e

repeat_count="$1"
shift

for ((run = 1; run <= repeat_count; run++)); do
    echo "[Run ${run}/${repeat_count}]"
    "$@"
done
