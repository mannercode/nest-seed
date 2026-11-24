#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?}"

SERVER_URL="http://nginx"
export PROJECT_ID="${PROJECT_ID:?}-replicas"
OUTPUT_DIR="_output/$(date '+%Y%m%d-%H%M%S')"
HTML_REPORT="${OUTPUT_DIR}/report.html"
JSON_SUMMARY="${OUTPUT_DIR}/summary.json"

mkdir -p _output
mkdir "${OUTPUT_DIR}"

compose=(
    docker compose --profile replicas
    -f "${WORKSPACE_ROOT}/infra/compose.apps.yml" -f compose.yml
)

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all nginx replica-api >&2
        "${compose[@]}" logs --no-color --timestamps nginx replica-api >&2
    fi
    "${compose[@]}" down -v -t 0 nginx replica-api
    local cleanup_exit_code=$?
    if [[ "${exit_code}" -eq 0 ]]; then
        exit_code=${cleanup_exit_code}
    fi
    exit "${exit_code}"
}

run_k6() {
    local -a environment=()
    local name
    for name in K6_WEB_DASHBOARD K6_WEB_DASHBOARD_PORT K6_WEB_DASHBOARD_PERIOD K6_WEB_DASHBOARD_EXPORT; do
        if [[ -v "${name}" ]]; then
            environment+=(--env "${name}=${!name}")
        fi
    done

    "${compose[@]}" run \
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
"${compose[@]}" down
trap cleanup EXIT
"${compose[@]}" up -d --build --wait nginx
wait_for_api

k6_arguments=(
    run
    --env "SERVER_URL=${SERVER_URL}"
    --env "SUMMARY_PATH=${JSON_SUMMARY}"
)
[[ -n "${DURATION_MS:-}" ]] && k6_arguments+=(--env "DURATION_MS=${DURATION_MS}")
[[ -n "${WARMUP_MS:-}" ]] && k6_arguments+=(--env "WARMUP_MS=${WARMUP_MS}")
k6_arguments+=(crud.js)

K6_WEB_DASHBOARD=true \
    K6_WEB_DASHBOARD_PORT=-1 \
    K6_WEB_DASHBOARD_PERIOD=2s \
    K6_WEB_DASHBOARD_EXPORT="${HTML_REPORT}" \
    run_k6 "${k6_arguments[@]}"

echo "HTML: ${PWD}/${HTML_REPORT}"
echo "JSON: ${PWD}/${JSON_SUMMARY}"
