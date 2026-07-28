#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

docker compose down -v -t 0
docker compose up -d

setup_id="$(docker compose ps -aq infra-setup)"
if [ -z "${setup_id}" ]; then
    echo "infra-setup container was not created" >&2
    exit 1
fi

setup_exit="$(docker wait "${setup_id}")"
if [ "${setup_exit}" -ne 0 ]; then
    echo "infra-setup failed with exit code ${setup_exit}" >&2
    docker compose ps -a
    docker compose logs --no-color mongo-setup infra-setup
    exit "${setup_exit}"
fi

docker compose ps -a --status=exited -q | xargs -r docker rm
