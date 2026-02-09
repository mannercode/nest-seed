#!/bin/bash

NAME="UserName#1"
BIRTHDATE="1990-01-01T00:00:00.000Z"
EMAIL="test@test.com"
PASSWORD="testpassword"

TEST "Create a customer" \
	201 POST /customers \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "'${NAME}'",
			"birthDate": "'${BIRTHDATE}'",
			"email": "'${EMAIL}'",
			"password": "'${PASSWORD}'"
		}'

customer_id=$(echo "${BODY}" | jq -r '.id')

login_customer

TEST "Retrieve Customer" \
	200 GET /customers/${customer_id} \
	-H "Authorization: Bearer ${ACCESS_TOKEN}"

TEST "Retrieve All Customers" \
	200 GET /customers \
	-H "Authorization: Bearer ${ACCESS_TOKEN}"

TEST "Update Customer" \
	200 PATCH /customers/${customer_id} \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${ACCESS_TOKEN}" \
	-d '{ "name": "new name", "email": "new@mail.com", "birthDate": "2000-01-01" }'

TEST "Delete Customer with Specific ID" \
	204 DELETE /customers/${customer_id} \
	-H "Authorization: Bearer ${ACCESS_TOKEN}"
