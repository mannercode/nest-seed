#!/usr/bin/env bash
# 공식 k6 이미지를 API 테스트 스택 네트워크와 현재 workspace에 연결해 실행한다.

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"
: "${COMPOSE_PROJECT_NAME:?}"

export COMPOSE_IGNORE_ORPHANS=True

env_args=()
for name in K6_WEB_DASHBOARD K6_WEB_DASHBOARD_PORT K6_WEB_DASHBOARD_PERIOD K6_WEB_DASHBOARD_EXPORT; do
    if [[ -v "$name" ]]; then
        env_args+=(--env "$name")
    fi
done

cd "${WORKSPACE_ROOT}"
exec pnpm compose:tools run \
    --rm \
    --no-deps \
    --no-TTY \
    --user "$(id -u):$(id -g)" \
    "${env_args[@]}" \
    k6 "$@"
