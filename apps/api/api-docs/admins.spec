#!/bin/bash
. ./common.fixture

TEST "개발 관리자 계정으로 로그인한다" \
	200 POST /admins/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'"${ADMIN_EMAIL}"'", "password": "'"${ADMIN_PASSWORD}"'" }'

ADMIN_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
ADMIN_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "리프레시 토큰으로 액세스 토큰을 재발급한다" \
	200 POST /admins/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${ADMIN_REFRESH_TOKEN}"'" }'

ADMIN_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
ADMIN_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "본인 관리자 정보를 조회한다" \
	200 GET /admins/me \
	-H "Authorization: Bearer ${ADMIN_ACCESS_TOKEN}"

TEST "본인 관리자 정보를 수정한다" \
	200 PATCH /admins/me \
	-H "Authorization: Bearer ${ADMIN_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{ "name": "Updated Docs Admin" }'

TEST "로그아웃을 요청하면 204를 반환한다" \
	204 POST /admins/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${ADMIN_REFRESH_TOKEN}"'" }'

TEST "로그아웃한 리프레시 토큰으로 재발급하면 401을 반환한다" \
	401 POST /admins/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${ADMIN_REFRESH_TOKEN}"'" }'
