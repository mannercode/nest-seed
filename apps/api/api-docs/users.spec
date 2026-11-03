#!/bin/bash
. ./common.fixture

USER_EMAIL=$(random_email)

TEST "사용자를 생성한다" \
	201 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01",
			"email": "'${USER_EMAIL}'",
			"password": "Example password 1!"
		}'

TEST "이미 가입한 이메일로 가입하면 409를 반환한다" \
	409 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01",
			"email": "'${USER_EMAIL}'",
			"password": "Example password 1!"
		}'

TEST "빈 요청 본문으로 가입하면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST "올바르지 않은 이메일 형식으로 가입하면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01",
			"email": "not-an-email",
			"password": "Example password 1!"
		}'

TEST "비밀번호 없이 가입하면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01",
			"email": "'"$(random_email)"'"
		}'

TEST "이메일과 비밀번호로 로그인한다" \
	200 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "Example password 1!" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "잘못된 비밀번호로 로그인하면 401을 반환한다" \
	401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "incorrect password" }'

TEST "존재하지 않는 이메일로 로그인하면 401을 반환한다" \
	401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "unknown@example.com", "password": "Example password 1!" }'

TEST "리프레시 토큰으로 액세스 토큰을 재발급한다" \
	200 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "형식이 잘못된 리프레시 토큰으로 갱신하면 401을 반환한다" \
	401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "invalid-token" }'

TEST "내 사용자 정보를 조회한다" \
	200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "인증 없이 내 사용자 정보를 조회하면 401을 반환한다" \
	401 GET /users/me

TEST "잘못된 액세스 토큰으로 내 사용자 정보를 조회하면 401을 반환한다" \
	401 GET /users/me \
	-H "Authorization: Bearer invalid-token"

# 본인 정보 수정은 /me로 한다(토큰 주체 기준).
TEST "사용자가 본인 정보를 수정한다" \
	200 PATCH /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "내가 바꾼 이름" }'

TEST "인증 없이 본인 정보를 수정하면 401을 반환한다" \
	401 PATCH /users/me \
	-H "Content-Type: application/json" \
	-d '{ "name": "x" }'

TEST "로그아웃을 요청하면 204를 반환한다" \
	204 POST /users/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST "로그아웃한 리프레시 토큰으로 재발급하면 401을 반환한다" \
	401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

SETUP POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "Example password 1!" }'
USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "사용자가 자신의 모든 세션을 로그아웃 처리한다" \
	204 POST /users/me/logout-all \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "전체 로그아웃 뒤 리프레시 토큰으로 재발급하면 401을 반환한다" \
	401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST "전체 로그아웃 뒤 기존 액세스 토큰으로 본인 정보를 조회하면 200을 반환한다" \
	200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

# 별도 계정으로 본인 삭제를 검증한다.
SELF_EMAIL=$(random_email)
TEST "본인 삭제 데모용 사용자를 생성한다" \
	201 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "self-delete",
			"birthDate": "1990-01-01",
			"email": "'${SELF_EMAIL}'",
			"password": "Example password 1!"
		}'

SETUP POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${SELF_EMAIL}'", "password": "Example password 1!" }'
SELF_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')

TEST "사용자가 본인 계정을 삭제한다" \
	204 DELETE /users/me \
	-H "Authorization: Bearer ${SELF_ACCESS_TOKEN}"
