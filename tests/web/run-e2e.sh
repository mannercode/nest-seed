#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

: "${COMPOSE_PROJECT_NAME:?Dev Container의 COMPOSE_PROJECT_NAME이 필요합니다}"

E2E_UID="$(id -u)"
E2E_GID="$(id -g)"
DEVCONTAINER_NETWORK="${COMPOSE_PROJECT_NAME}"
export E2E_UID E2E_GID DEVCONTAINER_NETWORK

compose=(
    docker compose
    --project-name "${COMPOSE_PROJECT_NAME}-web"
    --env-file "${WORKSPACE_ROOT}/.env.infra"
    --env-file "${WORKSPACE_ROOT}/.env.api"
    --env-file "${WORKSPACE_ROOT}/.env.seed"
    --file "${SCRIPT_DIR}/compose.yml"
)

mkdir -p "${SCRIPT_DIR}/_output"

list_only=false
open_ui=false
for argument in "$@"; do
    case "${argument}" in
        --list) list_only=true ;;
        --ui) open_ui=true ;;
    esac
done

if [[ "${list_only}" == true ]]; then
    "${compose[@]}" build playwright
    "${compose[@]}" run --rm --no-deps playwright "$@"
    exit
fi

cleanup() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "${exit_code}" -ne 0 ]]; then
        "${compose[@]}" ps --all >"${SCRIPT_DIR}/_output/compose-ps.txt" 2>&1
        "${compose[@]}" logs --no-color --timestamps >"${SCRIPT_DIR}/_output/compose-logs.txt" 2>&1
    fi

    "${compose[@]}" down -t 0
    exit "${exit_code}"
}
trap cleanup EXIT

"${compose[@]}" build api console user-app playwright
"${compose[@]}" up --detach --no-build --wait api console user-app

run_options=(--rm --no-deps)
if [[ "${open_ui}" == true ]]; then
    run_options+=(--service-ports)
fi
"${compose[@]}" run "${run_options[@]}" playwright "$@"
