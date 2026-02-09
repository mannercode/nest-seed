#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./common.cfg

if [ -z "${WORKSPACE_ROOT}" ]; then
	echo "WORKSPACE_ROOT is not set. Exiting."
	exit 1
fi

. "${WORKSPACE_ROOT}/.env"
HOST="http://localhost:${HTTP_PORT}"
echo "🚀 Starting infra..."
npm run infra:reset
npm run apps:reset

if ! CURL_OUTPUT=$(curl -sS "${HOST}" 2>&1); then
	echo "ERROR ${CURL_OUTPUT}"
	exit 2
fi

# 현재 디렉터리 및 하위 디렉터리의 모든 *.spec 파일을 수집(정렬해서 고정된 실행 순서)
mapfile -d '' -t specs < <(find . -type f -name '*.spec' -print0 | sort -z)

ERROR_LOG=""

for spec in "${specs[@]}"; do
	. "$spec"
done

npm run apps:down

if [[ -z "${ERROR_LOG}" ]]; then
	echo "Test Successful"
else
	echo "List of Failed Tests:"
	echo ""
	echo -e "${ERROR_LOG}"
	exit 3
fi
