#!/bin/bash
# shellcheck source-path=SCRIPTDIR
set -Eeuo pipefail
trap 'echo "[ERR] ${BASH_SOURCE[0]}:${LINENO} (종료 코드: $?)" >&2' ERR
if (( $# )); then
	echo 'bash run.sh는 인자 없이 실행하세요.' >&2
	exit 2
fi
cd "$(dirname "$0")"
. ./run.cfg

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
CYAN='\033[36m'
YELLOW='\033[33m'
MAGENTA='\033[35m'

LOG_LINE() {
	echo "$*" >>"${LOG_FILE}"
}

LOG_RESPONSE() {
	local body=$1

	if [[ -n "${body}" ]]; then
		printf '%s' "${body}" | jq '.' >>"${LOG_FILE}" 2>/dev/null || printf '%s\n' "${body}" >>"${LOG_FILE}"
	fi
}

is_api_url() {
	local url=${1%%\?*}
	[[ "${url}" == "${SERVER_URL}" || "${url}" == "${SERVER_URL}/"* ]]
}

CURL() {
	local method=$1
	local url=$2
	shift 2

	local -a args=("$@")

	# 가장 최근에 로그인한 사용자의 토큰을 자동 주입한다.
	# 호출자가 이미 Authorization 헤더를 명시했다면 그것을 우선한다.
	# spec은 `login_user`로 `CURRENT_AUTH_TOKEN`을 갈아끼우며 흐름을 표현한다.
	# presigned upload는 별도 인증을 쓰므로 API 주소와 그 하위 경로에만 토큰을 넣는다.
	if [[ -n "${CURRENT_AUTH_TOKEN:-}" ]] && is_api_url "${url}"; then
		local has_auth=0
		local arg
		for arg in "${args[@]}"; do
			if [[ "${arg}" == "Authorization: "* ]]; then
				has_auth=1
				break
			fi
		done
		if [[ "${has_auth}" -eq 0 ]]; then
			args+=(-H "Authorization: Bearer ${CURRENT_AUTH_TOKEN}")
		fi
	fi

	local curl_exit=0
	response=$(curl -sSX "${method}" -w "%{http_code}" "${url}" "${args[@]}") || curl_exit=$?

	if [[ "${curl_exit}" -ne 0 ]]; then
		local endpoint
		endpoint=$(format_endpoint "${url}")
		LOG_LINE "${method} ${endpoint} (curl 종료 코드: ${curl_exit})"
		printf '\n`%s %s`의 HTTP 응답을 끝까지 받지 못했다 (curl 종료 코드 %d). [로그](%s)\n' \
			"${method}" "$(markdown_escape "${endpoint}")" "${curl_exit}" "${LOG_FILE_LINK}" >>"${SUMMARY_MD}"
		printf '%b %s %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method "${method}")" "${endpoint}"
		printf '  curl 종료 코드: %d\n' "${curl_exit}"
		exit 1
	fi

	STATUS="${response:${#response}-3}"
	BODY="${response:0:${#response}-3}"
}

format_endpoint() {
	local endpoint=${1%%\?*}
	local path=${endpoint}
	local i=0
	local -a segments=()

	if is_api_url "${path}"; then
		path=${path#"${SERVER_URL}"}
	elif [[ "${path}" =~ ^https?:// ]]; then
		printf ':external'
		return
	fi

	IFS='/' read -r -a segments <<<"${path}"

	for ((i = 0; i < ${#segments[@]}; i++)); do
		if [[ "${segments[i]}" =~ ^[[:xdigit:]]+$ ]]; then
			segments[i]=':id'
		fi
	done

	echo "$(
		IFS=/
		echo "${segments[*]}"
	)"
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

markdown_escape() {
	local value=${1:-}
	value="${value//$'\n'/ }"
	value="${value//|/\\|}"
	printf '%s' "${value}"
}

init_summary() {
	local output_dir="${PWD}/_output"
	DOC_DIR="${output_dir}/docs"
	mkdir -p -- "${DOC_DIR}" "${output_dir}/logs"
	LOG_DIR=$(mktemp -d -- "${output_dir}/logs/$(date '+%Y%m%d_%H%M%S').XXXXXX")
	local run_id=${LOG_DIR##*/}
	LOG_DIR_LINK=$(realpath --relative-to="${DOC_DIR}" -- "${LOG_DIR}")
	SUMMARY_MD="${DOC_DIR}/${run_id}.md"

	{
		printf '# API 문서\n\n'
		printf '검증 대상 curl 예제\n\n'
		printf -- '- `%s`\n' "$@"
		printf '\n'
		printf -- '- 생성 시각: `%s`\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
		printf -- '- 상세 로그: [%s](%s/)\n\n' "${run_id}" "${LOG_DIR_LINK}"
		printf '| 그룹 | 설명 | Method | Endpoint | 기대 | 실제 | 결과 | 상세 |\n'
		printf '| --- | --- | --- | --- | ---: | ---: | --- | --- |\n'
	} >"${SUMMARY_MD}"
}

finish_summary() {
	local status=$1
	local result=완료
	if (( status != 0 )); then result=실패; fi
	printf '\n실행 %s (종료 코드 %d).\n' "${result}" "${status}" >>"${SUMMARY_MD}"

	# 다른 실행에서 읽는 도중에도 마지막으로 끝난 한 실행의 보고서 전체를 제공한다.
	cp -- "${SUMMARY_MD}" "${SUMMARY_MD}.tmp"
	mv -fT -- "${SUMMARY_MD}.tmp" "${DOC_DIR}/summary.md"
	printf '\n%b로그%b : %b%s%b\n' "${BOLD}" "${RESET}" "${CYAN}" "${LOG_DIR}" "${RESET}"
	printf '%b문서%b : %b%s%b\n' "${BOLD}" "${RESET}" "${CYAN}" "${SUMMARY_MD}" "${RESET}"
}

record_summary() {
	local description=$1
	local expected_status=$2
	local method=$3
	local endpoint=$4
	local group=${CURRENT_GROUP:?TEST가 spec 밖에서 호출됨}
	local display_endpoint
	local result

	display_endpoint=$(format_endpoint "${endpoint}")

	if [[ "${STATUS}" -eq "${expected_status}" ]]; then
		result='PASS'
	else
		result='FAIL'
	fi

	printf '| %s | %s | `%s` | `%s` | `%s` | `%s` | `%s` | [로그](%s) |\n' \
		"$(markdown_escape "${group}")" \
		"$(markdown_escape "${description}")" \
		"${method}" \
		"$(markdown_escape "${display_endpoint}")" \
		"${expected_status}" \
		"${STATUS}" \
		"${result}" \
		"${LOG_FILE_LINK}" >>"${SUMMARY_MD}"

}

TEST() {
	local description=$1
	local expected_status=$2
	local method=$3
	local endpoint=$4
	shift 4

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		FAILED_TESTS=$((FAILED_TESTS + 1))
		LOG_LINE "${method} $(format_endpoint "${endpoint}")"
		LOG_LINE "기대=${expected_status} 실제=$(format_response "${STATUS}" "${BODY}")"

		printf '%b %s %s → 실제 %s, 기대 %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method "${method}")" "$(format_endpoint "${endpoint}")" "$(format_response "${STATUS}" "${BODY}")" "${expected_status}"
	else
		PASSED_TESTS=$((PASSED_TESTS + 1))
		LOG_LINE "${method} $(format_endpoint "${endpoint}")"
		LOG_LINE "기대=${expected_status} 실제=${STATUS}"

		printf '%b %s %s → %s\n' "${BOLD}${GREEN}[PASS]${RESET}" "$(format_method "${method}")" "$(format_endpoint "${endpoint}")" "$(format_response "${STATUS}" "${BODY}")"
	fi

	LOG_RESPONSE "${BODY}"
	LOG_LINE ""

	record_summary "${description}" "${expected_status}" "${method}" "${endpoint}"
}

SETUP() {
	local expected_status=$1
	local method=$2
	local endpoint=$3
	shift 3

	LOG_LINE "# 준비 요청"

	CURL "${method}" "${SERVER_URL}${endpoint}" "$@"

	LOG_LINE "${method} $(format_endpoint "${endpoint}")"
	LOG_LINE "실제=$(format_response "${STATUS}" "${BODY}")"
	LOG_LINE ""

	if [[ "${STATUS}" -ne "${expected_status}" ]]; then
		LOG_LINE "# 준비 요청 실패 (기대 ${expected_status})"
		printf '%b SETUP %s %s (실제 %s)\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method "${method}")" "$(format_endpoint "${endpoint}")" "$(format_response "${STATUS}" "${BODY}")"
		exit 2
	fi
}

echo ""

shopt -s globstar nullglob dotglob
specs=(**/*.spec)

if (( ${#specs[@]} == 0 )); then
    echo '실행할 .spec 파일이 없습니다.' >&2
    exit 1
fi
for spec in "${specs[@]}"; do
    if [[ ! -f "$spec" ]]; then
        echo "실행할 수 없는 예제 파일: $spec" >&2
        exit 1
    fi
done

PASSED_TESTS=0
FAILED_TESTS=0

init_summary "${specs[@]}"
trap 'finish_summary "$?"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for spepath in "${specs[@]}"; do
	count_before=$((PASSED_TESTS + FAILED_TESTS))
	LOG_FILE_LINK="${LOG_DIR_LINK}/${spepath#./}.log"
	LOG_FILE="${DOC_DIR}/${LOG_FILE_LINK}"
	CURRENT_GROUP="$(basename "${spepath}" .spec)"
	mkdir -p "$(dirname "${LOG_FILE}")"
	: >>"${LOG_FILE}"

	. ./common.fixture
	pushd "$(dirname "${spepath}")" >/dev/null
	# shellcheck disable=SC1090 # spec 파일을 목록에서 받아 동적으로 source한다
	. "./$(basename "${spepath}")"
	popd >/dev/null
	if (( PASSED_TESTS + FAILED_TESTS == count_before )); then
		echo "검증을 한 건도 실행하지 않은 예제 파일: ${spepath}" >&2
		exit 1
	fi
done

echo ""
echo -e "${BOLD}성공${RESET} : ${GREEN}${PASSED_TESTS}${RESET}"
echo -e "${BOLD}실패${RESET} : ${RED}${FAILED_TESTS}${RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	exit 3
fi
