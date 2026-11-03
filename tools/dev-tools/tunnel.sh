#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

pids=()

start_tunnel() {
    local name=$1
    local port=$2

    cloudflared tunnel --url "http://localhost:${port}" > >(sed -u "s|^|${name}: |") 2>&1 &
    pids+=("$!")
}

cleanup() {
    kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_tunnel web "${WEB_PORT:?}"

wait -n "${pids[@]}"
