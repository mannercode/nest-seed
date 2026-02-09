#!/bin/bash
echo "$0"
. ./_utils.sh
. ./customers.fixture

CUSTOMER_EMAIL=$(random_email)

TEST "Create a customer" \
	201 POST /customers \
	-H 'Content-Type: application/json' \
	-d '{
			"email": "'${CUSTOMER_EMAIL}'",
			"password": "password",
			"name": "customer name",
			"birthDate": "1990-01-01T00:00:00.000Z"
		}'

CUSTOMER_ID=$(echo "${BODY}" | jq -r '.id')

TEST "Login Customer" \
	200 POST /customers/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${CUSTOMER_EMAIL}'", "password": "password" }'

CUSTOMER_ACCESS_TOKEN=$(echo "${BODY}" | jq -r '.accessToken')
CUSTOMER_REFRESH_TOKEN=$(echo "${BODY}" | jq -r '.refreshToken')

TEST "Refresh Access Token" \
	200 POST /customers/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${CUSTOMER_REFRESH_TOKEN}'" }'

CUSTOMER_ACCESS_TOKEN=$(echo ${BODY} | jq -r '.accessToken')
CUSTOMER_REFRESH_TOKEN=$(echo ${BODY} | jq -r '.refreshToken')

TEST "Retrieve Customer" \
	200 GET /customers/${CUSTOMER_ID} \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}"

TEST "Retrieve All Customers" \
	200 GET /customers \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}"

TEST "Update Customer" \
	200 PATCH /customers/${CUSTOMER_ID} \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "new name","email":"a@a.c", "birthDate": "2000-01-01" }'

SETUP PATCH /customers/${CUSTOMER_ID} \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "new name","email":"a@a.c", "birthDate": "2000-01-01" }'


TEST "Delete Customer with Specific ID" \
	204 DELETE /customers/${CUSTOMER_ID} \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}"
