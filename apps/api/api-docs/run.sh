#!/bin/bash
set -Eeuo pipefail
trap 'echo "[ERR] ${BASH_SOURCE[0]}:${LINENO} (종료 코드: $?)" >&2' ERR
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

	local curl_exit=0
	response=$(curl -sSX "${method}" -w "%{http_code}" "${url}" "$@") || curl_exit=$?

	if [[ "${curl_exit}" -ne 0 ]]; then
		printf '%b %s %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method ${method})" "${url}"
		printf '  curl 종료 코드: %d, 응답: %s\n' "${curl_exit}" "${response}"
		exit 1
	fi

	STATUS="${response:${#response}-3}"
	BODY="${response:0:${#response}-3}"
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

format_response() {
	local status=$1
	local body=${2:-}

	if [[ "${status}" -lt 400 ]]; then
		printf '%s' "${status}"
		return
	fi

	local code=''
	if [[ -n "${body}" ]]; then
		code=$(printf '%s' "${body}" | jq -r '.code // empty' 2>/dev/null || true)
	fi

	if [[ -n "${code}" ]]; then
		printf '%s, %s' "${status}" "${code}"
	else
		printf '%s' "${status}"
	fi
}

TEST() {
	local expected_status=$1
	local method=$2
	local endpoint=$3
	shift 3

	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		LOG_LINE "RES='${STATUS}(기대:${expected_status})"

		printf '%b %s %s → 실제 %s, 기대 %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method ${method})" "$(format_endpoint "${endpoint}")" "$(format_response "${STATUS}" "${BODY}")" "${expected_status}"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		LOG_LINE "RES='${STATUS}"

		printf '%b %s %s → %s\n' "${BOLD}${GREEN}[PASS]${RESET}" "$(format_method ${method})" "$(format_endpoint "${endpoint}")" "$(format_response "${STATUS}" "${BODY}")"
	fi

	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""
}

SETUP() {
	local method=$1
	local endpoint=$2
	shift 2

	LOG_LINE "# 준비 요청"
	LOG_COMMAND "${method}" "${SERVER_URL}${endpoint}" "$@"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	LOG_LINE "RES='${STATUS}"
	LOG_JSON "${BODY}"
	LOG_LINE "'"
	LOG_LINE ""

	if [[ "${STATUS}" -ge 400 ]]; then
		LOG_LINE "# 준비 요청 실패"
		printf '%b SETUP %s %s (상태 %s)\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method ${method})" "$(format_endpoint "${endpoint}")" "${STATUS}"
		printf '  %s\n' "${BODY}" | head -5
		exit 2
	fi
}

echo ""

specs=()
if [[ "$#" -eq 0 ]]; then
	while IFS= read -r -d '' f; do specs+=("$f"); done < <(find . -type f -name '*.spec' -print0 | sort -z)
else
	specs=("$@")
fi

PASSED_TESTS=0
FAILED_TESTS=0
LOG_FILE=''
LOG_DIR="$(pwd)/_output/logs/$(date '+%Y%m%d_%H%M%S')"

for spepath in "${specs[@]}"; do
	LOG_FILE="${LOG_DIR}/${spepath#./}.log"
	mkdir -p "$(dirname "${LOG_FILE}")"
	: >"${LOG_FILE}"

	pushd $(dirname "${spepath}") >/dev/null
	. "./$(basename "${spepath}")"
	popd >/dev/null
done

echo ""
echo -e "${BOLD}로그${RESET} : ${CYAN}${LOG_DIR}${RESET}"
echo -e "${BOLD}성공${RESET} : ${GREEN}${PASSED_TESTS}${RESET}"
echo -e "${BOLD}실패${RESET} : ${RED}${FAILED_TESTS}${RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	exit 3
fi
