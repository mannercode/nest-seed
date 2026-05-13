#!/bin/bash
. ./common.fixture

TEST 201 POST /theaters \
	-H 'Content-Type: application/json' \
	-d '{
			"name": "극장 이름",
			"location": { "latitude": 37.5665, "longitude": 126.9780 },
			"seatmap": {
				"blocks": [
					{ "name": "A", "rows": [{ "name": "1", "layout": "OOOOOOOO" }] }
				]
			}
		}'

THEATER_ID=$(echo "${BODY}" | jq -r '.id')

TEST 400 POST /theaters \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST 200 GET /theaters

TEST 200 GET /theaters/${THEATER_ID}

TEST 404 GET /theaters/000000000000000000000000

TEST 200 PATCH /theaters/${THEATER_ID} \
	-H 'Content-Type: application/json' \
	-d '{ "name": "수정된 극장 이름" }'

TEST 404 PATCH /theaters/000000000000000000000000 \
	-H 'Content-Type: application/json' \
	-d '{ "name": "x" }'

TEST 204 DELETE /theaters/${THEATER_ID}
