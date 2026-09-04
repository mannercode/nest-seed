#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?}"
: "${COMPOSE_PROJECT_NAME:?}"

set -a
# shellcheck source=../../../.env.infra
. "${WORKSPACE_ROOT}/.env.infra"
set +a

export COMPOSE_IGNORE_ORPHANS=True

SERVER_URL="http://nginx"
SEED_TARGET="${SEED_TARGET:-50000}"
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

login_admin() {
    local response
    response=$(curl -fsS -X POST "${SERVER_URL}/admins/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    ADMIN_ACCESS_TOKEN=$(jq -er '.accessToken' <<<"${response}")
    export ADMIN_ACCESS_TOKEN
}

theater_count() {
    curl -fsS "${SERVER_URL}/theaters?page=1&size=1" | jq -er '.total'
}

seed_theaters() {
    local attempts=0
    local count
    count=$(theater_count)

    while [[ "${count}" -lt "${SEED_TARGET}" ]]; do
        attempts=$((attempts + 1))
        if [[ "${attempts}" -gt 10 ]]; then
            echo "Error: theaters ${count}/${SEED_TARGET} after 10 seed runs" >&2
            return 1
        fi

        echo "Seeding theaters: ${count}/${SEED_TARGET}"
        run_k6 run --quiet \
            --env "MODE=seed" \
            --env "SERVER_URL=${SERVER_URL}" \
            --env "ADMIN_ACCESS_TOKEN=${ADMIN_ACCESS_TOKEN}" \
            --env "DURATION_MS=30000" \
            --env "SUMMARY_PATH=/dev/null" \
            crud.js >/dev/null
        count=$(theater_count)
    done

    echo "Theaters: ${count}"
}

echo "Building API benchmark stack"
"${compose[@]}" up -d --build --wait
"${compose[@]}" run --rm --no-deps restate-register
wait_for_api
login_admin
seed_theaters

k6_arguments=(
    run
    --env "MODE=benchmark"
    --env "SERVER_URL=${SERVER_URL}"
    --env "ADMIN_ACCESS_TOKEN=${ADMIN_ACCESS_TOKEN}"
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
