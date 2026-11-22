#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

pnpm run build

PROJECT_ID="api-docs-$(node -p 'crypto.randomUUID()')"
export PROJECT_ID MONGO_DATABASE="$PROJECT_ID" S3_BUCKET="$PROJECT_ID" NODE_ENV=test

cleanup() {
    local result=$? stopped=0
    if [[ -n ${server_pid:-} ]]; then
        if kill -0 -- "-$server_pid" 2>/dev/null; then
            kill -TERM -- "-$server_pid" || result=1
        fi
        wait "$server_pid" || stopped=$?
        if ((stopped != 0 && stopped != 143)); then result=$stopped; fi
    fi
    if [[ -n ${deployment_id:-} ]]; then
        curl -fsS -X DELETE "${RESTATE_ADMIN_URL:?}/deployments/$deployment_id?force=true" >/dev/null || result=1
    fi
    node test-resources.cjs cleanup "$PROJECT_ID" || result=1
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ports=$(node test-resources.cjs prepare "$PROJECT_ID")
read -r API_PORT RESTATE_SERVICE_PORT <<<"$ports"
export API_PORT RESTATE_SERVICE_PORT SERVER_URL="http://127.0.0.1:$API_PORT"

# npm과 npm이 시작한 API를 한 프로세스 그룹으로 종료한다.
set -m
LOG_CONSOLE_LEVEL=error npm start &
server_pid=$!
set +m
curl -fsS --max-time 2 --retry-connrefused --retry 30 --retry-delay 1 "$SERVER_URL/health" >/dev/null
kill -0 "$server_pid"

workflow_url="http://${COMPOSE_PROJECT_NAME:?}:$RESTATE_SERVICE_PORT"
deployment_id=$(
    curl -fsS "${RESTATE_ADMIN_URL:?}/deployments" \
        --json "{\"uri\":\"$workflow_url\",\"force\":false,\"use_http_11\":false}" | jq -er '.id'
)

bash api-docs/run.sh "$@"
