#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

run_k6() {
    local -a environment=()
    local name
    for name in K6_WEB_DASHBOARD K6_WEB_DASHBOARD_PORT K6_WEB_DASHBOARD_PERIOD K6_WEB_DASHBOARD_EXPORT; do
        if [[ -v "${name}" ]]; then
            environment+=(--env "${name}=${!name}")
        fi
    done

    docker compose run \
        --rm \
        --no-deps \
        --no-TTY \
        --workdir "${PWD}" \
        --user "$(id -u):$(id -g)" \
        "${environment[@]}" \
        k6 "$@"
}

run_benchmark() {
    SERVER_URL="http://nginx"
    OUTPUT_DIR="_output/$(date '+%Y%m%d-%H%M%S')"
    HTML_REPORT="${OUTPUT_DIR}/report.html"
    JSON_SUMMARY="${OUTPUT_DIR}/summary.json"

    mkdir -p _output
    mkdir "${OUTPUT_DIR}"

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
}

source "${WORKSPACE_ROOT:?}/infra/stack.sh"
with_stack test nginx run_benchmark
