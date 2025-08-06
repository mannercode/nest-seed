#!/bin/bash

TEST "Retrieve User" \
    200 GET /customers/$USER_ID \
    -H "Authorization: Bearer $ACCESS_TOKEN"

TEST "Retrieve All Users" \
    200 GET /customers \
    -H "Authorization: Bearer $ACCESS_TOKEN"

TEST "Update User" \
    200 PATCH /customers/$USER_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{ "name": "new name", "email": "new@mail.com", "birthDate": "2000-01-01" }'

TEST "Delete User with Specific ID" \
    200 DELETE /customers/$USER_ID \
    -H "Authorization: Bearer $ACCESS_TOKEN"
