#!/bin/bash

redact_json_for_log() {
	local payload=${1:-}

	if [[ -z "${payload}" ]]; then
		return
	fi

	jq -c '
		def sensitive_key:
			ascii_downcase
			| gsub("[^a-z0-9]"; "")
			| test("(password|authorization|accesstoken|refreshtoken|clientsecret|secret|xamzcredential|xamzsignature|xamzsecuritytoken|policy|urls?)$");
		walk(
			if type == "object" then
				with_entries(
					if (.key | sensitive_key) then
						.value = "[REDACTED]"
					else
						.
					end
				)
			else
				.
			end
		)
	' <<<"${payload}"
}

redact_log_argument() {
	local argument=${1:-}
	local normalized=${argument,,}

	case "${normalized}" in
	authorization:* | proxy-authorization:*)
		printf 'Authorization: [REDACTED]'
		;;
	x-api-key:* | api-key:* | x-auth-token:* | x-amz-security-token:*)
		printf 'X-Api-Key: [REDACTED]'
		;;
	cookie:* | set-cookie:*)
		printf 'Cookie: [REDACTED]'
		;;
	*)
		if jq -e . >/dev/null 2>&1 <<<"${argument}"; then
			redact_json_for_log "${argument}"
		else
			printf '%s' "${argument}" | sed -E \
				-e 's/([?&](access[_-]?token|refresh[_-]?token|password|token|client[_-]?secret|secret|x-amz-(credential|signature|security-token)|policy)=)[^&]*/\1%5BREDACTED%5D/gI' \
				-e 's/^((access[_-]?token|refresh[_-]?token|password|token|client[_-]?secret|secret|x-amz-(credential|signature|security-token)|policy)=).*/\1[REDACTED]/I'
		fi
		;;
	esac
}

redact_body_for_log() {
	local body=${1:-}

	if [[ -z "${body}" ]]; then
		return
	fi

	if jq -e . >/dev/null 2>&1 <<<"${body}"; then
		redact_json_for_log "${body}"
	else
		# API 응답 계약은 JSON이다. 프록시·외부 서버가 돌려준 임의 텍스트는
		# 요청 자격증명을 반사할 수 있으므로 상세 로그에 남기지 않는다.
		printf '[NON_JSON_BODY_OMITTED]'
	fi
}
