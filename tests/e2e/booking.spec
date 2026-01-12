#!/bin/bash

MOVIE_ID=$(create_movie)
THEATER_ID=$(create_theater "Booking Theater" 37.0 127.0)

request_showtime_creation "${MOVIE_ID}" "${THEATER_ID}" "${DEFAULT_SHOWTIME_START}" 120
wait_for_showtimes "${THEATER_ID}" >/dev/null

TEST "Search Booking Theaters" \
    200 GET /booking/movies/${MOVIE_ID}/theaters?latLong=37.0,127.0

BOOKING_THEATER_ID=$(echo ${BODY} | jq -r '.[0].id')

TEST "Search Booking Showdates" \
    200 GET /booking/movies/${MOVIE_ID}/theaters/${BOOKING_THEATER_ID}/showdates

TEST "Search Booking Showtimes" \
    200 GET /booking/movies/${MOVIE_ID}/theaters/${BOOKING_THEATER_ID}/showdates/${DEFAULT_SHOWDATE}/showtimes

SHOWTIME_ID=$(echo ${BODY} | jq -r '.[0].id')

TEST "Get Tickets for Showtime" \
    200 GET /booking/showtimes/${SHOWTIME_ID}/tickets

TICKET_IDS=$(echo ${BODY} | jq -c '.[0:2] | map(.id)')

TEST "Hold Tickets" \
    200 POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{ \"ticketIds\": ${TICKET_IDS} }"
