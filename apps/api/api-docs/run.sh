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

RUN_ID="$(date '+%Y%m%d_%H%M%S')"
OUTPUT_ROOT="$(pwd)/_output"
LOG_DIR="${OUTPUT_ROOT}/logs/${RUN_ID}"
DOC_DIR="${OUTPUT_ROOT}/docs"
SUMMARY_MD="${DOC_DIR}/summary.md"
SUMMARY_JSON="${DOC_DIR}/summary.json"
SUMMARY_JSONL="${DOC_DIR}/summary.jsonl"

CURRENT_GROUP=''
CURRENT_SPEC=''

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

	local -a args=("$@")

	# 가장 최근에 로그인한 주체(admin 또는 user)의 토큰을 자동 주입한다.
	# 호출자가 이미 Authorization 헤더를 명시했다면 그것을 우선한다.
	# spec은 `login_admin` / `login_user`로 `CURRENT_AUTH_TOKEN`을 갈아끼우며 흐름을 표현한다.
	# presigned upload처럼 외부 storage로 가는 호출은 자기 인증 방식이 따로 있으므로 `SERVER_URL` 접두사로 시작하는 API 호출에만 자동 주입한다.
	if [[ -n "${CURRENT_AUTH_TOKEN:-}" && "${url}" == "${SERVER_URL}"* ]]; then
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
		printf '%b %s %s\n' "${BOLD}${RED}[FAIL]${RESET}" "$(format_method ${method})" "${url}"
		printf '  curl 종료 코드: %d, 응답: %s\n' "${curl_exit}" "${response}"
		exit 1
	fi

	# 로그도 자동 주입된 헤더를 포함해 실제 호출 그대로 남긴다.
	LOG_COMMAND "${method}" "${url}" "${args[@]}"

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

markdown_escape() {
	local value=${1:-}
	value="${value//$'\n'/ }"
	value="${value//|/\\|}"
	printf '%s' "${value}"
}

init_summary() {
	mkdir -p "${DOC_DIR}"
	: >"${SUMMARY_JSONL}"

	{
		printf '# API 문서\n\n'
		printf '실행 가능한 curl spec에서 생성한 최신 API 호출 목록이다.\n\n'
		printf -- '- 생성 시각: `%s`\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
		printf -- '- 서버: `%s`\n' "${SERVER_URL}"
		printf -- '- 상세 로그: [%s](../logs/%s/)\n\n' "${RUN_ID}" "${RUN_ID}"
		printf '| 그룹 | 설명 | Method | Endpoint | 기대 | 실제 | 결과 | 상세 |\n'
		printf '| --- | --- | --- | --- | ---: | ---: | --- | --- |\n'
	} >"${SUMMARY_MD}"
}

record_summary() {
	local description=$1
	local expected_status=$2
	local method=$3
	local endpoint=$4
	local group=${CURRENT_GROUP:?TEST가 spec 밖에서 호출됨}
	local display_endpoint
	local log_path
	local result

	display_endpoint=$(format_endpoint "${endpoint}")
	log_path="${LOG_FILE#${OUTPUT_ROOT}/}"

	if [[ "${STATUS}" -eq "${expected_status}" ]]; then
		result='PASS'
	else
		result='FAIL'
	fi

	printf '| %s | %s | `%s` | `%s` | `%s` | `%s` | `%s` | [로그](../%s) |\n' \
		"$(markdown_escape "${group}")" \
		"$(markdown_escape "${description}")" \
		"${method}" \
		"$(markdown_escape "${display_endpoint}")" \
		"${expected_status}" \
		"${STATUS}" \
		"${result}" \
		"${log_path}" >>"${SUMMARY_MD}"

	jq -cn \
		--arg runId "${RUN_ID}" \
		--arg spec "${CURRENT_SPEC}" \
		--arg group "${group}" \
		--arg description "${description}" \
		--arg method "${method}" \
		--arg endpoint "${display_endpoint}" \
		--arg actualEndpoint "${endpoint}" \
		--arg expectedStatus "${expected_status}" \
		--arg actualStatus "${STATUS}" \
		--arg result "${result}" \
		--arg log "../${log_path}" \
		'{
			runId: $runId,
			spec: $spec,
			group: $group,
			description: $description,
			method: $method,
			endpoint: $endpoint,
			actualEndpoint: $actualEndpoint,
			expectedStatus: ($expectedStatus | tonumber),
			actualStatus: ($actualStatus | tonumber),
			result: $result,
			log: $log
		}' >>"${SUMMARY_JSONL}"
}

finalize_summary() {
	jq -s '.' "${SUMMARY_JSONL}" >"${SUMMARY_JSON}"
	rm -f "${SUMMARY_JSONL}"
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

	record_summary "${description}" "${expected_status}" "${method}" "${endpoint}"
}

SETUP() {
	local method=$1
	local endpoint=$2
	shift 2

	LOG_LINE "# 준비 요청"

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

init_summary

for spepath in "${specs[@]}"; do
	LOG_FILE="${LOG_DIR}/${spepath#./}.log"
	CURRENT_SPEC="${spepath#./}"
	CURRENT_GROUP="$(basename "${spepath}" .spec)"
	mkdir -p "$(dirname "${LOG_FILE}")"
	: >"${LOG_FILE}"

	pushd "$(dirname "${spepath}")" >/dev/null
	# shellcheck disable=SC1090 # spec 파일을 목록에서 받아 동적으로 source한다
	. "./$(basename "${spepath}")"
	popd >/dev/null
done

finalize_summary

echo ""
echo -e "${BOLD}로그${RESET} : ${CYAN}${LOG_DIR}${RESET}"
echo -e "${BOLD}문서${RESET} : ${CYAN}${SUMMARY_MD}${RESET}"
echo -e "${BOLD}JSON${RESET} : ${CYAN}${SUMMARY_JSON}${RESET}"
echo -e "${BOLD}성공${RESET} : ${GREEN}${PASSED_TESTS}${RESET}"
echo -e "${BOLD}실패${RESET} : ${RED}${FAILED_TESTS}${RESET}"

if [[ "${FAILED_TESTS}" -gt 0 ]]; then
	exit 3
fi
