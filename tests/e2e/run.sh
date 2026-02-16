#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./.env
. ./utils.cfg

mkdir -p logs
LOG_FILE="./logs/$(date '+%Y%m%d_%H%M%S').log"
exec 4>&1
exec 3>"${LOG_FILE}"
exec 1>&3 2>&3

PASSED_TESTS=0
FAILED_TESTS=0

C_RESET=$'\033[0m'
C_GREEN=$'\033[32m'
C_RED=$'\033[31m'
C_CYAN=$'\033[36m'

FINALIZE() {
	{
		echo ""
		echo "${C_CYAN}log:${C_RESET} ${LOG_FILE}"
		echo "Success: ${C_GREEN}${PASSED_TESTS}${C_RESET}, Failed: ${C_RED}${FAILED_TESTS}${C_RESET}"
	} >&4
}
trap FINALIZE EXIT

RESOLVE_URL() {
	local endpoint=$1

	if [[ "${endpoint}" =~ ^https?:// ]]; then
		printf '%s\n' "${endpoint}"
	else
		printf '%s%s\n' "${SERVER_URL}" "${endpoint}"
	fi
}

PRINT_COMMAND() {
	local method=$1
	local endpoint=$2
	shift 2

	local url
	url=$(RESOLVE_URL "${endpoint}")

	local -a command=(curl -sSX "${method}" "${url}" "$@")
	local arg

	for arg in "${command[@]}"; do
		arg="${arg//$'\n'/ }"
		arg="${arg//$'\t'/ }"

		if [[ "${arg}" =~ [[:space:]] ]]; then
			printf "'%s' " "${arg//\'/\'\\\'\'}"
		else
			printf '%s ' "${arg}"
		fi
	done

	echo
}

CURL() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	local url
	url=$(RESOLVE_URL "${ENDPOINT}")

	if response=$(curl -sSX "${METHOD}" -w "%{http_code}" "${url}" "$@"); then
		STATUS="${response:${#response}-3}"
		BODY="${response:0:${#response}-3}"
	else
		exit 1
	fi
}

TEST() {
	TITLE=$1
	EXPECTED_STATUS=$2
	METHOD=$3
	ENDPOINT=$4
	shift 4

	echo "# ${TITLE}" >&2
	PRINT_COMMAND "${METHOD}" "${ENDPOINT}" "$@" >&2

	CURL "${METHOD}" "${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ne "${EXPECTED_STATUS}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		responseStatus="${STATUS}(expected:${EXPECTED_STATUS})"

		echo "${C_RED}[FAIL]${C_RESET} ${TITLE}" >&4
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		responseStatus="${STATUS}"

		echo "${C_GREEN}[PASS]${C_RESET} ${TITLE}" >&4
	fi

	echo "RES='${responseStatus}"
	echo "${BODY}" | jq '.' || echo "${BODY}"
	echo "'"
	echo ""
	true
}

SETUP() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	CURL "${METHOD}" "${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ge 400 ]]; then
		echo "# Setup failed" >&2
		PRINT_COMMAND "${METHOD}" "${ENDPOINT}" "$@" >&2

		echo "RES='${STATUS}" >&2
		echo "${BODY}" | jq '.' >&2 || echo "${BODY}" >&2
		echo "'" >&2
		echo "" >&2
		exit 2
	fi
}

# collect all spec files and route candidates
mapfile -d '' -t all_specs < <(find ./specs -type f -name '*.spec' -print0 | sort -z)

ROUTES=()
for spec in "${all_specs[@]}"; do
	route="/${spec#./specs/}"
	route="${route%.spec}"
	ROUTES+=("${route}")
done

SELECTED_ROUTE=''
if [[ $# -ge 1 ]]; then
	SELECTED_ROUTE=$1
elif [[ -t 0 && -t 1 ]]; then
	echo "" >&4
	echo "Select e2e path:" >&4
	SELECTED_ROUTE=$(prompt_selection / "${ROUTES[@]}" 2>&4)
else
	SELECTED_ROUTE=/
fi

specs=()
if [[ "${SELECTED_ROUTE}" == "/" ]]; then
	specs=("${all_specs[@]}")
else
	for spec in "${all_specs[@]}"; do
		route="/${spec#./specs/}"
		route="${route%.spec}"

		if [[ "${route}" == "${SELECTED_ROUTE}" ]]; then
			specs=("${spec}")
			break
		fi
	done

	if [[ "${#specs[@]}" -eq 0 ]]; then
		echo "Invalid path selector: ${SELECTED_ROUTE}" >&4
		echo "Available: / ${ROUTES[*]}" >&4
		echo "Invalid path selector: ${SELECTED_ROUTE}" >&2
		echo "Available: / ${ROUTES[*]}" >&2
		exit 2
	fi
fi

for spec in "${specs[@]}"; do
	spec_dir=$(dirname "$spec")
	spec_file=$(basename "$spec")

	pushd "$spec_dir" >/dev/null
	. "./$spec_file"
	popd >/dev/null
done

if [[ "${FAILED_TESTS}" -eq 0 ]]; then
	echo "# Test Successful"
	exit 0
fi

echo "# Test Failed"
exit 3
