#!/bin/bash

TEST "Request Access Token Refresh" \
    200 POST /customers/refresh \
    -H 'Content-Type: application/json' \
    -d '{ "refreshToken": "'$REFRESH_TOKEN'" }'

ACCESS_TOKEN=$(echo $BODY | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $BODY | jq -r '.refreshToken')

TEST "Test Access Token" \
    200 GET /customers \
    -H "Authorization: Bearer $ACCESS_TOKEN"
