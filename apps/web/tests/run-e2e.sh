#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
export PLAYWRIGHT_VERSION
source "${WORKSPACE_ROOT:?}/infra/test.sh"
COMPOSE_FILE+=":${PWD}/compose.e2e.yml"
with_test_stack web \
    docker compose run --rm --no-deps --use-aliases --user "$(id -u):$(id -g)" e2e "$@"
