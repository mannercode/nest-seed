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
	local method=$1
	local url=$2
	shift 2

	local -a command=(curl -sSX "${method}" "${url}" "$@")
	local arg
	local command_line=''

	for arg in "${command[@]}"; do
		arg="${arg//$'\n'/ }"
		arg="${arg//$'\t'/ }"

		if [[ "${arg}" =~ [[:space:]] ]]; then
			command_line+="'${arg//\'/\'\\\'\'}' "
		else
			command_line+="${arg} "
		fi
	done

	LOG_LINE "${command_line}"
}

CURL() {
	local method=$1
	local url=$2
	shift 2

	local response
	if response=$(curl -sSX "${method}" -w "%{http_code}" "${url}" "$@"); then
		STATUS="${response:${#response}-3}"
		BODY="${response:0:${#response}-3}"
	else
		exit 1
	fi
}

TEST() {
	local title=$1
	local expected_status=$2
	local method=$3
	local endpoint=$4
	shift 4
	local response_status

	LOG_LINE "# ${title}"
	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		response_status="${STATUS}(expected:${expected_status})"

		CONSOLE_LINE "${C_RED}[FAIL]${C_RESET} ${title}"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		response_status="${STATUS}"

		CONSOLE_LINE "${C_GREEN}[PASS]${C_RESET} ${title}"
	fi

	LOG_LINE "RES='${response_status}"
	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""
	true
}

SETUP() {
	local method=$1
	local endpoint=$2
	shift 2

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ge 400 ]]; then
		LOG_LINE "# Setup failed"
		LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"
		LOG_LINE "RES='${STATUS}"
		LOG_JSON "${BODY}"
		LOG_LINE "'"
		LOG_LINE ""
		exit 2
	fi
}

PASSED_TESTS=0
FAILED_TESTS=0

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
