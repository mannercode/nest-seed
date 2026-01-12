#!/bin/bash

MOVIE_ID=$(create_movie)
THEATER_ID=$(create_theater "Showtime Theater" 35.5 128.0)

TEST "Search Showtime Creation Movies" \
    200 GET /showtime-creation/movies

TEST "Search Showtime Creation Theaters" \
    200 GET /showtime-creation/theaters

TEST "Search Showtime Creation Showtimes (Empty)" \
    200 POST /showtime-creation/showtimes:search \
    -H 'Content-Type: application/json' \
    -d "{ \"theaterIds\": [\"${THEATER_ID}\"] }"

SAGA_ID=$(request_showtime_creation "${MOVIE_ID}" "${THEATER_ID}")
SHOWTIME_ID=$(wait_for_showtimes "${THEATER_ID}")

TEST_STREAM "Showtime Creation Event Stream" \
    200 GET /showtime-creation/event-stream
