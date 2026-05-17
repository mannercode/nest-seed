#!/bin/bash
. ./common.fixture

USER_EMAIL=$(random_email)

TEST "사용자를 생성한다" \
	201 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'${USER_EMAIL}'",
			"password": "password"
		}'

USER_ID=$(echo "${BODY}" | jq -r '.id')

TEST "이미 가입한 이메일로 가입하면 409를 반환한다" \
	409 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'${USER_EMAIL}'",
			"password": "password"
		}'

TEST "빈 요청 본문으로 가입하면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST "이메일 형식이 올바르지 않으면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "not-an-email",
			"password": "password"
		}'

TEST "비밀번호 없이 가입하면 400을 반환한다" \
	400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'$(random_email)'"
		}'

TEST "이메일과 비밀번호로 로그인한다" \
	200 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "password" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "잘못된 비밀번호로 로그인하면 401을 반환한다" \
	401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "wrong-password" }'

TEST "존재하지 않는 이메일로 로그인하면 401을 반환한다" \
	401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "unknown@example.com", "password": "password" }'

TEST "리프레시 토큰으로 액세스 토큰을 재발급한다" \
	200 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "형식이 잘못된 리프레시 토큰이면 500을 반환한다" \
	500 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "invalid-token" }'

TEST "내 사용자 정보를 조회한다" \
	200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "인증 없이 내 사용자 정보를 조회하면 401을 반환한다" \
	401 GET /users/me

TEST "잘못된 액세스 토큰으로 내 사용자 정보를 조회하면 500을 반환한다" \
	500 GET /users/me \
	-H "Authorization: Bearer invalid-token"

TEST "인증 사용자가 사용자 목록을 조회한다" \
	200 GET /users \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "인증 없이 사용자 목록을 조회하면 401을 반환한다" \
	401 GET /users

TEST "사용자 상세 정보를 조회한다" \
	200 GET /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "존재하지 않는 사용자를 조회하면 404를 반환한다" \
	404 GET /users/000000000000000000000000 \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "사용자 정보를 수정한다" \
	200 PATCH /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "수정된 사용자 이름", "birthDate": "2000-01-01T00:00:00.000Z" }'

TEST "존재하지 않는 사용자를 수정하면 404를 반환한다" \
	404 PATCH /users/000000000000000000000000 \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "수정된 사용자 이름" }'

TEST "리프레시 토큰을 로그아웃 처리한다" \
	204 POST /users/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST "로그아웃한 리프레시 토큰으로 재발급하면 401을 반환한다" \
	401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST "사용자를 삭제한다" \
	204 DELETE /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
