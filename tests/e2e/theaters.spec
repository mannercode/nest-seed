#!/bin/bash

THEATER_ID=$(create_theater "Sample Theater" 37.5 127.0)

TEST "Get Theater" \
    200 GET /theaters/${THEATER_ID}

TEST "Update Theater" \
    200 PATCH /theaters/${THEATER_ID} \
    -H 'Content-Type: application/json' \
    -d '{ "name": "Updated Theater" }'

TEST "Search Theaters" \
    200 GET /theaters

TEST "Delete Theater" \
    204 DELETE /theaters/${THEATER_ID}
