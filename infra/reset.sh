#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"
workspace_dir="$(cd .. && pwd)"

set -a
# shellcheck source=../.env.infra
. "${workspace_dir}/.env.infra"
set +a

diagnose_and_exit() {
    local exit_code="$1"

    trap - ERR
    set +e
    timeout 10s docker compose ps -a >&2
    timeout 30s docker compose logs --no-color --tail 100 >&2
    exit "${exit_code}"
}

trap 'diagnose_and_exit "$?"' ERR

docker compose down -v -t 0
docker compose up -d

setup_id="$(docker compose ps -aq infra-setup)"
if [ -z "${setup_id}" ]; then
    echo "infra-setup container was not created" >&2
    diagnose_and_exit 1
fi

setup_exit="$(docker wait "${setup_id}")"
if [ "${setup_exit}" -ne 0 ]; then
    echo "infra-setup failed with exit code ${setup_exit}" >&2
    diagnose_and_exit "${setup_exit}"
fi

docker compose rm -f \
    infra-setup mongo-setup redis-setup s3-setup

cd "${workspace_dir}"
NODE_ENV=development pnpm run admin:create
