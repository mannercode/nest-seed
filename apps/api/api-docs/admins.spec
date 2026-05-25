#!/bin/bash
. ./common.fixture

DOCS_ADMIN_EMAIL="docs-admin@example.com"
DOCS_ADMIN_PASSWORD="docsAdminPass1!"
DOCS_ADMIN_NAME="Docs Admin"

TEST "root가 Basic Auth로 admin을 생성한다" \
	201 POST /admins \
	-H "Authorization: ${ROOT_BASIC_AUTH}" \
	-H 'Content-Type: application/json' \
	-d '{
			"email": "'"${DOCS_ADMIN_EMAIL}"'",
			"password": "'"${DOCS_ADMIN_PASSWORD}"'",
			"name": "'"${DOCS_ADMIN_NAME}"'"
		}'

DOCS_ADMIN_ID=$(echo "${BODY}" | jq -r '.id')

TEST "Authorization 헤더가 없으면 401을 반환한다" \
	401 POST /admins \
	-H 'Content-Type: application/json' \
	-d '{ "email": "x@example.com", "password": "p", "name": "x" }'

TEST "root password가 틀리면 401을 반환한다" \
	401 POST /admins \
	-H "Authorization: Basic $(printf 'root:wrong-password' | base64)" \
	-H 'Content-Type: application/json' \
	-d '{ "email": "x@example.com", "password": "p", "name": "x" }'

TEST "Basic 외 다른 스킴이면 401을 반환한다" \
	401 POST /admins \
	-H 'Authorization: Bearer something' \
	-H 'Content-Type: application/json' \
	-d '{ "email": "x@example.com", "password": "p", "name": "x" }'

TEST "이미 같은 이메일이 있으면 409를 반환한다" \
	409 POST /admins \
	-H "Authorization: ${ROOT_BASIC_AUTH}" \
	-H 'Content-Type: application/json' \
	-d '{
			"email": "'"${DOCS_ADMIN_EMAIL}"'",
			"password": "'"${DOCS_ADMIN_PASSWORD}"'",
			"name": "'"${DOCS_ADMIN_NAME}"'"
		}'

TEST "생성된 admin으로 로그인한다" \
	200 POST /admins/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'"${DOCS_ADMIN_EMAIL}"'", "password": "'"${DOCS_ADMIN_PASSWORD}"'" }'

DOCS_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
DOCS_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "리프레시 토큰으로 액세스 토큰을 재발급한다" \
	200 POST /admins/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${DOCS_REFRESH_TOKEN}"'" }'

DOCS_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
DOCS_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "자기 admin 정보를 조회한다" \
	200 GET /admins/me \
	-H "Authorization: Bearer ${DOCS_ACCESS_TOKEN}"

TEST "자기 admin 정보를 수정한다" \
	200 PATCH /admins/me \
	-H "Authorization: Bearer ${DOCS_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{ "name": "Updated Docs Admin" }'

TEST "로그아웃하면 같은 리프레시 토큰을 다시 쓸 수 없다" \
	204 POST /admins/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${DOCS_REFRESH_TOKEN}"'" }'

TEST "로그아웃한 리프레시 토큰으로 재발급하면 401이다" \
	401 POST /admins/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${DOCS_REFRESH_TOKEN}"'" }'

TEST "root가 Basic Auth로 admin을 삭제한다" \
	204 DELETE /admins/${DOCS_ADMIN_ID} \
	-H "Authorization: ${ROOT_BASIC_AUTH}"

TEST "삭제 호출에 root 자격증명이 없으면 401을 반환한다" \
	401 DELETE /admins/${DOCS_ADMIN_ID}
