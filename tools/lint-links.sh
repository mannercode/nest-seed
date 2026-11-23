#!/bin/bash
exec docker compose -p "${COMPOSE_PROJECT_NAME:?}-lint" \
    -f "${WORKSPACE_ROOT:?}/tools/compose.yml" run --rm lychee
