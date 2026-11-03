#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?}"
: "${COMPOSE_PROJECT_NAME:?}"

export COMPOSE_IGNORE_ORPHANS=True

SERVER_URL="http://nginx"
OUTPUT_DIR="_output/$(date '+%Y%m%d-%H%M%S')"

mkdir -p _output
mkdir "${OUTPUT_DIR}"

compose=(docker compose -f ../compose.yml)

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all >&2
        "${compose[@]}" logs --no-color --timestamps >&2
    fi
    "${compose[@]}" down -v -t 0
    local cleanup_exit_code=$?
    if [[ "${exit_code}" -eq 0 ]]; then
        exit_code=${cleanup_exit_code}
    fi
    exit "${exit_code}"
}
trap cleanup EXIT

run_k6() {
    local -a environment=()
    local name
    for name in K6_WEB_DASHBOARD K6_WEB_DASHBOARD_PORT K6_WEB_DASHBOARD_PERIOD K6_WEB_DASHBOARD_EXPORT; do
        if [[ -v "${name}" ]]; then
            environment+=(--env "${name}=${!name}")
        fi
    done

    pnpm --dir "${WORKSPACE_ROOT}" compose:tools run \
        --rm \
        --no-deps \
        --no-TTY \
        --workdir "${PWD}" \
        --user "$(id -u):$(id -g)" \
        "${environment[@]}" \
        k6 "$@"
}

wait_for_api() {
    for attempt in {1..30}; do
        if curl -fsS "${SERVER_URL}/health" >/dev/null 2>&1; then
            return
        fi
        if [[ "${attempt}" -eq 30 ]]; then
            echo "Error: ${SERVER_URL}/health did not respond" >&2
            return 1
        fi
        sleep 1
    done
}

echo "Building API benchmark stack"
"${compose[@]}" up -d --build --wait
"${compose[@]}" run --rm --no-deps restate-register
wait_for_api

k6_arguments=(
    run
    --env "SERVER_URL=${SERVER_URL}"
    --env "SUMMARY_PATH=${OUTPUT_DIR}/summary.json"
)
[[ -n "${DURATION_MS:-}" ]] && k6_arguments+=(--env "DURATION_MS=${DURATION_MS}")
[[ -n "${WARMUP_MS:-}" ]] && k6_arguments+=(--env "WARMUP_MS=${WARMUP_MS}")
k6_arguments+=(crud.js)

K6_WEB_DASHBOARD=true \
    K6_WEB_DASHBOARD_PORT=-1 \
    K6_WEB_DASHBOARD_PERIOD=2s \
    K6_WEB_DASHBOARD_EXPORT="${OUTPUT_DIR}/report.html" \
    run_k6 "${k6_arguments[@]}"

echo "HTML: ${OUTPUT_DIR}/report.html"
echo "JSON: ${OUTPUT_DIR}/summary.json"
