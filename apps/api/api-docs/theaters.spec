#!/bin/bash
. ./common.fixture

TEST "극장을 생성한다" \
	201 POST /theaters \
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

TEST "필수 값 없이 극장을 생성하면 400을 반환한다" \
	400 POST /theaters \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST "극장 목록을 조회한다" \
	200 GET /theaters

TEST "극장 상세 정보를 조회한다" \
	200 GET /theaters/${THEATER_ID}

TEST "존재하지 않는 극장을 조회하면 404를 반환한다" \
	404 GET /theaters/000000000000000000000000

TEST "극장 정보를 수정한다" \
	200 PATCH /theaters/${THEATER_ID} \
	-H 'Content-Type: application/json' \
	-d '{ "name": "수정된 극장 이름" }'

TEST "존재하지 않는 극장을 수정하면 404를 반환한다" \
	404 PATCH /theaters/000000000000000000000000 \
	-H 'Content-Type: application/json' \
	-d '{ "name": "x" }'

TEST "극장을 삭제한다" \
	204 DELETE /theaters/${THEATER_ID}
