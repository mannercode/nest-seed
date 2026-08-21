#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")"
# shellcheck source=log-redaction.sh
. ./log-redaction.sh

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

assert_equal() {
	local expected=$1
	local actual=$2
	local description=$3

	[[ "${actual}" == "${expected}" ]] || fail "${description}: expected '${expected}', got '${actual}'"
}

assert_equal \
	'Authorization: [REDACTED]' \
	"$(redact_log_argument 'Authorization: Bearer header-secret')" \
	'Authorization header'

assert_equal \
	'Authorization: [REDACTED]' \
	"$(redact_log_argument 'AUTHORIZATION: Basic mixed-case-secret')" \
	'mixed-case Authorization header'

assert_equal \
	'X-Api-Key: [REDACTED]' \
	"$(redact_log_argument 'X-Api-Key: api-key-secret')" \
	'API key header'

assert_equal \
	'Cookie: [REDACTED]' \
	"$(redact_log_argument 'Cookie: session=cookie-secret')" \
	'Cookie header'

assert_equal \
	'https://example.com/callback?access_token=%5BREDACTED%5D&state=public' \
	"$(redact_log_argument 'https://example.com/callback?access_token=query-secret&state=public')" \
	'sensitive query parameter'

assert_equal \
	'https://storage.example.com/upload?X-Amz-Credential=%5BREDACTED%5D&X-Amz-Signature=%5BREDACTED%5D&partNumber=1' \
	"$(redact_log_argument 'https://storage.example.com/upload?X-Amz-Credential=credential-secret&X-Amz-Signature=signature-secret&partNumber=1')" \
	'presigned URL query parameters'

assert_equal \
	'x-amz-signature=[REDACTED]' \
	"$(redact_log_argument 'x-amz-signature=form-signature-secret')" \
	'presigned form signature'

assert_equal \
	'Policy=[REDACTED]' \
	"$(redact_log_argument 'Policy=form-policy-secret')" \
	'presigned form policy'

redacted_json=$(redact_json_for_log '{
	"email": "user@example.com",
	"password": "password-secret",
	"url": "https://storage.example.com/upload?X-Amz-Signature=response-signature-secret",
	"imageUrls": [
		"https://storage.example.com/download?X-Amz-Credential=array-credential-secret&X-Amz-Signature=array-signature-secret"
	],
	"urls": [
		"https://storage.example.com/another?X-Amz-Signature=generic-array-signature-secret"
	],
	"fields": {
		"X-Amz-Credential": "response-credential-secret",
		"X-Amz-Signature": "response-signature-secret",
		"X-Amz-Security-Token": "response-security-token-secret",
		"Policy": "response-policy-secret",
		"key": "public/object-key"
	},
	"nested": {
		"accessToken": "access-secret",
		"refreshToken": "refresh-secret"
	}
}')

assert_equal 'user@example.com' "$(jq -r '.email' <<<"${redacted_json}")" 'non-sensitive JSON field'
assert_equal '[REDACTED]' "$(jq -r '.password' <<<"${redacted_json}")" 'password field'
assert_equal '[REDACTED]' "$(jq -r '.nested.accessToken' <<<"${redacted_json}")" 'access token field'
assert_equal '[REDACTED]' "$(jq -r '.nested.refreshToken' <<<"${redacted_json}")" 'refresh token field'
assert_equal '[REDACTED]' "$(jq -r '.url' <<<"${redacted_json}")" 'presigned response URL'
assert_equal '[REDACTED]' "$(jq -r '.imageUrls' <<<"${redacted_json}")" 'presigned response URL array'
assert_equal '[REDACTED]' "$(jq -r '.urls' <<<"${redacted_json}")" 'generic response URL array'
assert_equal '[REDACTED]' "$(jq -r '.fields["X-Amz-Credential"]' <<<"${redacted_json}")" 'presigned credential field'
assert_equal '[REDACTED]' "$(jq -r '.fields["X-Amz-Signature"]' <<<"${redacted_json}")" 'presigned signature field'
assert_equal '[REDACTED]' "$(jq -r '.fields["X-Amz-Security-Token"]' <<<"${redacted_json}")" 'presigned security token field'
assert_equal '[REDACTED]' "$(jq -r '.fields.Policy' <<<"${redacted_json}")" 'presigned policy field'
assert_equal 'public/object-key' "$(jq -r '.fields.key' <<<"${redacted_json}")" 'non-sensitive presigned field'

assert_equal \
	'[NON_JSON_BODY_OMITTED]' \
	"$(redact_body_for_log 'upstream echoed Bearer response-secret')" \
	'non-JSON response body'

printf 'API docs log redaction contract PASS\n'
