#!/bin/bash
. ./common.fixture

USER_EMAIL=$(random_email)

TEST 201 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'${USER_EMAIL}'",
			"password": "password"
		}'

USER_ID=$(echo "${BODY}" | jq -r '.id')

TEST 409 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'${USER_EMAIL}'",
			"password": "password"
		}'

TEST 400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST 400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "not-an-email",
			"password": "password"
		}'

TEST 400 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "사용자 이름",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'$(random_email)'"
		}'

TEST 200 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "password" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST 401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "wrong-password" }'

TEST 401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "unknown@example.com", "password": "password" }'

TEST 200 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST 500 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "invalid-token" }'

TEST 200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST 401 GET /users/me

TEST 500 GET /users/me \
	-H "Authorization: Bearer invalid-token"

TEST 200 GET /users \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST 401 GET /users

TEST 200 GET /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST 404 GET /users/000000000000000000000000 \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST 200 PATCH /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "수정된 사용자 이름", "birthDate": "2000-01-01T00:00:00.000Z" }'

TEST 404 PATCH /users/000000000000000000000000 \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "수정된 사용자 이름" }'

TEST 204 POST /users/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST 401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST 204 DELETE /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
