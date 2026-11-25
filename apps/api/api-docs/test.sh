#!/bin/bash
set -Eeuo pipefail
cd -- "${WORKSPACE_ROOT:?}"

export COMPOSE_FILE=infra/compose.apps.yml
api_host="${COMPOSE_PROJECT_NAME:?}-api-docs"
export SERVER_URL="http://${api_host}:${API_PORT:?}"
docs_dir=$(mktemp -d)
container_id=

cleanup() {
    local status=$?
    trap - EXIT
    set +e
    if [[ -n "${container_id}" ]]; then
        if ((status != 0)); then docker logs "${container_id}" >&2; fi
        docker stop "${container_id}" >/dev/null || status=1
        docker rm -v "${container_id}" >/dev/null || status=1
    fi
    rm -r -- "${docs_dir}" || status=1
    exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# 외부에 전달하는 예제 묶음을 풀어 그대로 검증한다.
bash apps/api/pack-api-docs.sh | tar -C "${docs_dir}" -xzf -
bash "${WORKSPACE_ROOT}/infra/compose-down.sh"
docker compose build api
container_id=$(docker compose run --detach --name "${api_host}" \
    --env "PROJECT_ID=${PROJECT_ID:?}-docs" \
    --env "RESTATE_DEPLOYMENT_URI=http://${api_host}:${RESTATE_SERVICE_PORT:?}" \
    --env LOG_CONSOLE_LEVEL=error api)
curl -fsS --retry 10 --retry-delay 1 --retry-connrefused "${SERVER_URL}/health" >/dev/null
bash "${docs_dir}/run.sh" "$@"
