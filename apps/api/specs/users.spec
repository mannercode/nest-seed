#!/bin/bash
. ./common.fixture

USER_EMAIL=$(random_email)

TEST "Create a user" \
	201 POST /users \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "user name",
			"birthDate": "1990-01-01T00:00:00.000Z",
			"email": "'${USER_EMAIL}'",
			"password": "password"
		}'

USER_ID=$(echo "${BODY}" | jq -r '.id')

TEST "Login user" \
	200 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "password" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "Refresh user tokens" \
	200 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

USER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
USER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "Retrieve current user" \
	200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "Retrieve users page" \
	200 GET /users \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "Retrieve user by ID" \
	200 GET /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "Update user by ID" \
	200 PATCH /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "new name", "birthDate": "2000-01-01T00:00:00.000Z" }'

TEST "Delete user by ID" \
	204 DELETE /users/${USER_ID} \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
