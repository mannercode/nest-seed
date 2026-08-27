#!/bin/bash
. ./common.fixture

# 관리자 권한으로 상영 자원을 준비한 뒤 일반 사용자로 로그인해 예매 흐름을 검증한다.
login_admin
setup_showtime_resources

create_and_login_user

TEST "영화 주변 극장을 거리순으로 조회한다" \
	200 GET "/booking/movies/${MOVIE_ID}/theaters?latLong=37.5665,126.9780"

TEST "극장의 상영 날짜를 조회한다" \
	200 GET /booking/movies/${MOVIE_ID}/theaters/${THEATER_ID}/showdates

SHOWDATE=$(echo "${BODY}" | jq -r '.[0] | split("T")[0] | gsub("-"; "")')

TEST "상영 날짜의 상영 시간을 조회한다" \
	200 GET /booking/movies/${MOVIE_ID}/theaters/${THEATER_ID}/showdates/${SHOWDATE}/showtimes

SHOWTIME_ID=$(echo "${BODY}" | jq -r '.[0].id')

wait_for_tickets

TEST "상영 시간의 좌석 티켓을 조회한다" \
	200 GET /booking/showtimes/${SHOWTIME_ID}/tickets

TICKET_ID_1=$(echo "${BODY}" | jq -r '.[0].id')
TICKET_ID_2=$(echo "${BODY}" | jq -r '.[1].id')

TEST "인증 사용자가 선택한 티켓을 선점한다" \
	204 POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{ "ticketIds": ["'${TICKET_ID_1}'", "'${TICKET_ID_2}'"] }'
