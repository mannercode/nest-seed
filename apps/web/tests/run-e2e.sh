#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
export PLAYWRIGHT_VERSION
exec bash "${WORKSPACE_ROOT:?}/infra/stack.sh" test -f "${PWD}/compose.e2e.yml" web \
    docker compose run --rm --no-deps --use-aliases --user "$(id -u):$(id -g)" e2e "$@"
