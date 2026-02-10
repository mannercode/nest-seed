#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./.env

LOG_FILE="./$(date '+%Y%m%d_%H%M%S').log"
exec 4>&1
exec 3>"${LOG_FILE}"
exec 1>&3 2>&3

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

FINALIZE() {
	# message="\e[1;31mSetup failed:\e[0m\n\e[1;35m${METHOD}\e[0m \e[1;36m${SERVER_URL}${ENDPOINT}\e[0m\n$@"
	{
		echo ""
		echo "log: ${LOG_FILE}"
		echo "executed: ${TOTAL_TESTS}, success: ${PASSED_TESTS}, failed: ${FAILED_TESTS}"
	} >&4
}
trap FINALIZE EXIT


CURL() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	if response=$(curl -s -w "%{http_code}" -X "${METHOD}" "${SERVER_URL}${ENDPOINT}" "$@"); then
		STATUS="${response:${#response}-3}"
		BODY="${response:0:${#response}-3}"
	else
		echo "error = $?, response = $response"
		exit 1
	fi
}

TEST() {
	TITLE=$1
	EXPECTED_STATUS=$2
	METHOD=$3
	ENDPOINT=$4
	shift 4

	CURL "${METHOD}" "${ENDPOINT}" "$@"

	message="${TITLE}\n${METHOD} ${SERVER_URL}${ENDPOINT}\n$@"

	TOTAL_TESTS=$((TOTAL_TESTS + 1))

	if [[ "${STATUS}" -ne "${EXPECTED_STATUS}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		responseStatus="${STATUS}(expected:${EXPECTED_STATUS})"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		responseStatus="${STATUS}"
	fi

	echo "${message}" >&2
	echo "↩ ${responseStatus}" >&2
	echo "${BODY}" | jq '.' >&2
	echo "" >&2
	true
}

SETUP() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	CURL "${METHOD}" "${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ge 400 ]]; then
		message="Setup failed:\n${METHOD} ${SERVER_URL}${ENDPOINT}\n$@"
		echo "${message}" >&2
		echo "↩ ${STATUS}" >&2
		echo "${BODY}" | jq '.' >&2
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
	echo "Test Successful"
	exit 0
fi

echo "Test Failed"
exit 3
