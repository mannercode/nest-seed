#!/usr/bin/env bash
set -euo pipefail

: "${COMPOSE_PROJECT_NAME:?}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
logging_network_name="${COMPOSE_PROJECT_NAME}"
export LOGGING_NETWORK_NAME="${logging_network_name}"

# 개발 인프라 reset이 중앙 로그 volume까지 지우지 않도록 별도 Compose project를 쓴다.
exec docker compose \
    --project-name "${logging_network_name}-logging" \
    --file "${script_dir}/compose.yml" \
    "$@"
