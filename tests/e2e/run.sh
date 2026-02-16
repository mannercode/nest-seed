#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./.env

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

# collect all spec files
mapfile -d '' -t specs < <(find . -type f -name '*.spec' -print0 | sort -z)

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
