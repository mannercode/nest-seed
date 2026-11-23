#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?Dev Container의 WORKSPACE_ROOT가 필요합니다}"
: "${COMPOSE_PROJECT_NAME:?Dev Container의 COMPOSE_PROJECT_NAME이 필요합니다}"
: "${DEVCONTAINER_NETWORK:?Dev Container의 DEVCONTAINER_NETWORK가 필요합니다}"

mkdir -p _output

for argument in "$@"; do
    if [[ "${argument}" == --list ]]; then
        exec pnpm exec playwright test "$@"
    fi
done

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
export PLAYWRIGHT_VERSION
compose=(
    docker compose --project-name "${COMPOSE_PROJECT_NAME}-web"
    -f "${WORKSPACE_ROOT}/compose.yml" -f compose.e2e.yml
)

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all >&2
        "${compose[@]}" logs --no-color --timestamps >&2
    fi

    "${compose[@]}" down -t 0
    local cleanup_exit_code=$?
    if [[ "${exit_code}" -eq 0 ]]; then
        exit_code=${cleanup_exit_code}
    fi
    exit "${exit_code}"
}
trap cleanup EXIT

"${compose[@]}" up --detach --build --wait web

"${compose[@]}" run --rm --use-aliases --user "$(id -u):$(id -g)" e2e "$@"
