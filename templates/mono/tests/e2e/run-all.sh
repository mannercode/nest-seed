#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"
. ./.env

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
CYAN='\033[36m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
PURPLE=$'\033[1;35m'

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

format_endpoint() {
	local endpoint=$1
	local path=$endpoint
	local query=''
	local i=0
	local -a segments=()

	if [[ "${endpoint}" == *\?* ]]; then
		path="${endpoint%%\?*}"
		query="?${endpoint#*\?}"
	fi

	IFS='/' read -r -a segments <<<"${path}"

	for ((i = 0; i < ${#segments[@]}; i++)); do
		if [[ "${segments[i]}" =~ ^[0-9]{8}$ ]]; then
			segments[i]=':date'
		elif [[ "${segments[i]}" =~ ^[[:xdigit:]]+$ ]]; then
			segments[i]=':id'
		fi
	done

	echo "$(
		IFS=/
		echo "${segments[*]}"
	)${query}"
}

format_method() {
	local method=$1
	local method_style="${BOLD}"

	case "${method}" in
	GET) method_style="${BOLD}${CYAN}" ;;
	POST) method_style="${BOLD}${MAGENTA}" ;;
	PATCH | PUT) method_style="${BOLD}${YELLOW}" ;;
	DELETE) method_style="${BOLD}${RED}" ;;
	esac

	printf '%b%-6s%b' "${method_style}" "${method}" "${RESET}"
}

TEST() {
	local description=$1
	local expected_status=$2
	local method=$3
	local endpoint=$4
	shift 4

	LOG_LINE "# ${description}"
	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		LOG_LINE "RES='${STATUS}(expected:${expected_status})"

		printf '%b %s %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method ${method})" "$(format_endpoint "${endpoint}")"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		LOG_LINE "RES='${STATUS}"

		printf '%b %s %s\n' "${BOLD}${GREEN}[PASS]${RESET}" "$(format_method ${method})" "$(format_endpoint "${endpoint}")"
	fi

	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""
}

SETUP() {
	local method=$1
	local endpoint=$2
	shift 2

	LOG_LINE "# Setup"
	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	LOG_LINE "RES='${STATUS}"
	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""

	if [[ "${STATUS}" -ge 400 ]]; then
		LOG_LINE "# Setup failed"
		exit 2
	fi
}

echo ""

specs=()
if [[ "$#" -eq 0 ]]; then
	while IFS= read -r -d '' f; do specs+=("$f"); done < <(find ./specs -type f -name '*.spec' -print0 | sort -z)
else
	specs=("$@")
fi

PASSED_TESTS=0
FAILED_TESTS=0
LOG_FILE=''
LOG_DIR="$(pwd)/logs/$(date '+%Y%m%d_%H%M%S')"

for spepath in "${specs[@]}"; do
	LOG_FILE="${LOG_DIR}/${spepath#./specs/}.log"
	mkdir -p "$(dirname "${LOG_FILE}")"
	: >"${LOG_FILE}"

	pushd $(dirname "${spepath}") >/dev/null
	. "./$(basename "${spepath}")"
	popd >/dev/null
done

echo ""
echo -e "${BOLD}logs${RESET}   : ${CYAN}${LOG_DIR}${RESET}"
echo -e "${BOLD}passed${RESET} : ${GREEN}${PASSED_TESTS}${RESET}"
echo -e "${BOLD}failed${RESET} : ${RED}${FAILED_TESTS}${RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	exit 3
fi
