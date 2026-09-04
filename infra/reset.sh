#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

: "${WORKSPACE_ROOT:?}"
compose=(docker compose)

set -a
. "${WORKSPACE_ROOT}/.env.infra"
set +a

diagnose_and_exit() {
    local exit_code="$1"

    trap - ERR
    set +e
    timeout 10s "${compose[@]}" ps -a >&2
    timeout 30s "${compose[@]}" logs --no-color --tail 100 >&2
    exit "${exit_code}"
}

trap 'diagnose_and_exit "$?"' ERR

"${compose[@]}" down -v -t 0
"${compose[@]}" up -d

setup_id="$("${compose[@]}" ps -aq infra-setup)"
if [ -z "${setup_id}" ]; then
    echo "infra-setup container was not created" >&2
    diagnose_and_exit 1
fi

setup_exit="$(docker wait "${setup_id}")"
if [ "${setup_exit}" -ne 0 ]; then
    echo "infra-setup failed with exit code ${setup_exit}" >&2
    diagnose_and_exit "${setup_exit}"
fi

"${compose[@]}" rm -f \
    infra-setup mongo-setup redis-setup s3-setup

printf '%s\n%s\n%s\n' \
    "${ADMIN_EMAIL}" \
    "${ADMIN_NAME}" \
    "${ADMIN_PASSWORD}" | NODE_ENV=development pnpm --dir "${WORKSPACE_ROOT}" run admin:create
