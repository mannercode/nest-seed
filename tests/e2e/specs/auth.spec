#!/bin/bash

create_customer

TEST "Login Customer" \
	200 POST /customers/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${EMAIL}'", "password": "'${PASSWORD}'" }'

access_token=$(echo "${BODY}" | jq -r '.accessToken')
refresh_token=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "Refresh Access Token" \
	200 POST /customers/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${refresh_token}'" }'

access_token=$(echo ${BODY} | jq -r '.accessToken')
refresh_token=$(echo ${BODY} | jq -r '.refreshToken')

TEST "Use Access Token" \
	200 GET /customers \
	-H "Authorization: Bearer ${access_token}"
