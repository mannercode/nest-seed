#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?Dev Container의 WORKSPACE_ROOT가 필요합니다}"

mkdir -p _output

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
export PLAYWRIGHT_VERSION
export COMPOSE_FILE="${WORKSPACE_ROOT}/infra/compose.apps.yml:${PWD}/compose.e2e.yml"
compose=(docker compose)

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all api web e2e >&2
        "${compose[@]}" logs --no-color --timestamps api web e2e >&2
    fi

    bash "${WORKSPACE_ROOT}/infra/compose-down.sh" -t 0
    local cleanup_exit_code=$?
    if [[ "${exit_code}" -eq 0 ]]; then
        exit_code=${cleanup_exit_code}
    fi
    exit "${exit_code}"
}

bash "${WORKSPACE_ROOT}/infra/compose-down.sh"
trap cleanup EXIT
"${compose[@]}" up --detach --build --wait web

"${compose[@]}" run --rm --use-aliases --user "$(id -u):$(id -g)" e2e "$@"
