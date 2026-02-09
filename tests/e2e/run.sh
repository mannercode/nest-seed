#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./.env

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

	message="${TITLE}\n\e[1;35m${METHOD}\e[0m \e[1;36m${SERVER_URL}${ENDPOINT}\e[0m\n$@"

	if [[ "${STATUS}" -ne "${EXPECTED_STATUS}" ]]; then
		ERROR_LOG="${ERROR_LOG}${message}\n\n"
		responseStatus="\e[1;31m${STATUS}\e[0m(\e[1;32mexpected:${EXPECTED_STATUS}\e[0m)"
	else
		responseStatus="\e[1;32m${STATUS}\e[0m"
	fi

	echo -e "${message}" >&2
	echo -e "↩\n${responseStatus}" >&2
	echo "${BODY}" | jq '.' >&2
	echo "" >&2
}

SETUP() {
	METHOD=$1
	ENDPOINT=$2
	shift 2

	CURL "${METHOD}" "${ENDPOINT}" "$@"

	if [[ "${STATUS}" -ge 400 ]]; then
		message="\e[1;31mSetup failed:\e[0m\n\e[1;35m${METHOD}\e[0m \e[1;36m${SERVER_URL}${ENDPOINT}\e[0m\n$@"
		echo -e "${message}" >&2
		echo -e "↩\n\e[1;31m${STATUS}\e[0m" >&2
		echo "${BODY}" | jq '.' >&2
		exit 2
	fi
}

ERROR_LOG=""

# collect all spec files
mapfile -d '' -t specs < <(find . -type f -name '*.spec' -print0 | sort -z)

for spec in "${specs[@]}"; do
	spec_dir=$(dirname "$spec")
	spec_file=$(basename "$spec")

	pushd "$spec_dir" >/dev/null
	. "./$spec_file"
	popd >/dev/null
done

if [[ -z "${ERROR_LOG}" ]]; then
	echo -e "\e[1;32mTest Successful\e[0m\n"
else
	echo -e "\e[1;31mList of Failed Tests:\e[0m\n"
	echo -e "${ERROR_LOG}"
	exit 3
fi
