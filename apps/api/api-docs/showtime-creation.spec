#!/bin/bash
. ./common.fixture

create_movie
publish_movie
create_theater

SHOWTIME_START_TIME=$(date -u -d '+1 day' '+%Y-%m-%dT%H:%M:%S.000Z')

TEST "상영 생성에 사용할 영화 목록을 조회한다" \
	200 GET /showtime-creation/movies

TEST "상영 생성에 사용할 극장 목록을 조회한다" \
	200 GET /showtime-creation/theaters

TEST "상영 시간 대량 생성을 요청한다" \
	202 POST /showtime-creation/showtimes \
	-H 'Content-Type: application/json' \
	-d '{
			"movieId": "'${MOVIE_ID}'",
			"theaterIds": ["'${THEATER_ID}'"],
			"durationInMinutes": 120,
			"startTimes": ["'${SHOWTIME_START_TIME}'"]
		}'

wait_for_showtime

TEST "극장별 상영 시간을 검색한다" \
	200 POST /showtime-creation/showtimes/search \
	-H 'Content-Type: application/json' \
	-d '{ "theaterIds": ["'${THEATER_ID}'"] }'
