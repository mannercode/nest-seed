#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"
. ./.env

C_RESET='\033[0m'
C_GREEN='\033[32m'
C_RED='\033[31m'
C_CYAN='\033[36m'

ON_ERROR() {
	local exit_code=$1
	local line_no=$2
	local command=$3
	CONSOLE_LINE "${C_RED}[ERROR]${C_RESET} line ${line_no}: ${command} (exit ${exit_code})"
}
trap 'ON_ERROR "$?" "${LINENO}" "${BASH_COMMAND}"' ERR

mkdir -p logs
LOG_FILE="./logs/$(date '+%Y%m%d_%H%M%S').log"
exec 4>&1
exec 3>"${LOG_FILE}"
exec 1>&3
exec 2> >(tee -a "${LOG_FILE}" >&4)

CONSOLE_LINE() {
	printf '%b\n' "$*" >&4
}

LOG_LINE() {
	printf '%s\n' "$*"
}

LOG_JSON() {
	local payload=$1
	printf '%s\n' "${payload}" | jq '.' 2>/dev/null || printf '%s\n' "${payload}"
}

LOG_COMMAND() {
	local METHOD=$1
	local URL=$2
	shift 2

	local -a command=(curl -sSX "${METHOD}" "${URL}" "$@")
	local arg
	local commandLine=''

	for arg in "${command[@]}"; do
		arg="${arg//$'\n'/ }"
		arg="${arg//$'\t'/ }"

		if [[ "${arg}" =~ [[:space:]] ]]; then
			commandLine+="'${arg//\'/\'\\\'\'}' "
		else
			commandLine+="${arg} "
		fi
	done

	LOG_LINE "${commandLine}"
}

CURL() {
	METHOD=$1
	URL=$2
	shift 2

	if response=$(curl -sSX "${METHOD}" -w "%{http_code}" "${URL}" "$@"); then
		STATUS="${response:${#response}-3}"
		BODY="${response:0:${#response}-3}"
	else
		exit 1
	fi
}

PASSED_TESTS=0
FAILED_TESTS=0

TEST() {
	TITLE=$1
	EXPECTED_STATUS=$2
	METHOD=$3
	ENDPOINT=$4
	shift 4

	LOG_LINE "# ${TITLE}"
	LOG_COMMAND "${METHOD}" "${SERVER_URL}${ENDPOINT}" "$@"

	CURL "${METHOD}" "${SERVER_URL}${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ne "${EXPECTED_STATUS}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		responseStatus="${STATUS}(expected:${EXPECTED_STATUS})"

		CONSOLE_LINE "${C_RED}[FAIL]${C_RESET} ${TITLE}"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		responseStatus="${STATUS}"

		CONSOLE_LINE "${C_GREEN}[PASS]${C_RESET} ${TITLE}"
	fi

	LOG_LINE "RES='${responseStatus}"
	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""
	true
}

SETUP() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	CURL "${METHOD}" "${SERVER_URL}${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ge 400 ]]; then
		LOG_LINE "# Setup failed"
		LOG_COMMAND "${METHOD}" "${SERVER_URL}${ENDPOINT}" "$@"
		LOG_LINE "RES='${STATUS}"
		LOG_JSON "${BODY}"
		LOG_LINE "'"
		LOG_LINE ""
		exit 2
	fi
}

specs=()
if [[ "$#" -eq 0 ]]; then
	mapfile -d '' -t specs < <(find ./specs -type f -name '*.spec' -print0 | sort -z)
else
	specs=("$@")
fi

for spec in "${specs[@]}"; do
	spec_dir=$(dirname "$spec")
	spec_file=$(basename "$spec")

	pushd "$spec_dir" >/dev/null
	. "./$spec_file"
	popd >/dev/null
done

CONSOLE_LINE ""
CONSOLE_LINE "${C_CYAN}log:${C_RESET} ${LOG_FILE}"
CONSOLE_LINE "Passed: ${C_GREEN}${PASSED_TESTS}${C_RESET}, Failed: ${C_RED}${FAILED_TESTS}${C_RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	CONSOLE_LINE "# Test Failed"
	exit 3
fi

CONSOLE_LINE "# Test Passed"
