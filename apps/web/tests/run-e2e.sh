#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?Dev Container의 WORKSPACE_ROOT가 필요합니다}"

mkdir -p _output

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
export PLAYWRIGHT_VERSION
compose=(docker compose -f "${WORKSPACE_ROOT}/infra/compose.apps.yml" -f compose.e2e.yml)

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all api web e2e >&2
        "${compose[@]}" logs --no-color --timestamps api web e2e >&2
    fi

    "${compose[@]}" down -t 0
    local cleanup_exit_code=$?
    if [[ "${exit_code}" -eq 0 ]]; then
        exit_code=${cleanup_exit_code}
    fi
    exit "${exit_code}"
}

"${compose[@]}" --profile '*' down
trap cleanup EXIT
"${compose[@]}" up --detach --build --wait web

"${compose[@]}" run --rm --use-aliases --user "$(id -u):$(id -g)" e2e "$@"
