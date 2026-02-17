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

	echo -e "${C_RED}[ERROR]${C_RESET} line ${line_no}: ${command} (exit ${exit_code})"
	exit "${exit_code}"
}
trap 'ON_ERROR "$?" "${LINENO}" "${BASH_COMMAND}"' ERR

log_dir="$(pwd)/logs/$(date '+%Y%m%d_%H%M%S')"
mkdir -p "${log_dir}"

LOG_FILE=''

LOG_LINE() {
	echo "$*" >>"${LOG_FILE}"
}

LOG_JSON() {
	local payload=$1
	echo "${payload}" | jq '.' >>"${LOG_FILE}" 2>/dev/null || echo "${payload}" >>"${LOG_FILE}"
}

LOG_COMMAND() {
	local method=$1
	local url=$2
	shift 2

	local -a command=(curl -sSX "${method}" "${url}" "$@")
	local arg
	local line=''

	for arg in "${command[@]}"; do
		arg="${arg//$'\n'/ }"
		arg="${arg//$'\t'/ }"

		if [[ "${arg}" =~ [[:space:]] ]]; then
			line+="'${arg//\'/\'\\\'\'}' "
		else
			line+="${arg} "
		fi
	done

	LOG_LINE "${line}"
}

CURL() {
	local method=$1
	local url=$2
	shift 2

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

	LOG_LINE "# ${title}"
	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		LOG_LINE "RES='${STATUS}(expected:${expected_status})"

		echo -e "${C_RED}[FAIL]${C_RESET} ${title}"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		LOG_LINE "RES='${STATUS}"

		echo -e "${C_GREEN}[PASS]${C_RESET} ${title}"
	fi

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
	spec_rel_path=${spec#./specs/}
	if [[ "${spec_rel_path}" == "${spec}" ]]; then
		spec_rel_path=$(basename "${spec}")
	fi
	LOG_FILE="${log_dir}/${spec_rel_path}.log"
	mkdir -p "$(dirname "${LOG_FILE}")"
	: >"${LOG_FILE}"

	pushd "${spec_dir}" >/dev/null
	. "./${spec_file}"
	popd >/dev/null
done

echo ""
echo -e "${C_CYAN}logs:${C_RESET} ${log_dir}"
echo -e "Passed: ${C_GREEN}${PASSED_TESTS}${C_RESET}, Failed: ${C_RED}${FAILED_TESTS}${C_RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	echo -e "# Test Failed"
	exit 3
fi

echo -e "# Test Passed"
