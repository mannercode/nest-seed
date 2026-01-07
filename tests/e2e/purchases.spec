#!/bin/bash

MOVIE_ID=$(create_movie)
THEATER_ID=$(create_theater "Purchase Theater" 36.0 128.0)

request_showtime_creation "${MOVIE_ID}" "${THEATER_ID}" "${DEFAULT_SHOWTIME_START}" 120
SHOWTIME_ID=$(wait_for_showtimes "${THEATER_ID}")

TEST "Get Tickets for Showtime" \
    200 GET /booking/showtimes/${SHOWTIME_ID}/tickets

TICKET_IDS=$(echo ${BODY} | jq -c '.[0:2] | map(.id)')

TEST "Hold Tickets for Purchase" \
    200 POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{ \"ticketIds\": ${TICKET_IDS} }"

PURCHASE_ITEMS=$(echo ${TICKET_IDS} | jq -c 'map({ type: "ticket", ticketId: . })')

TEST "Create Purchase" \
    201 POST /purchases \
    -H 'Content-Type: application/json' \
    -d "{
            \"customerId\": \"${USER_ID}\",
            \"totalPrice\": 20000,
            \"purchaseItems\": ${PURCHASE_ITEMS}
        }"

PURCHASE_ID=$(echo ${BODY} | jq -r '.id')

TEST "Get Purchase" \
    200 GET /purchases/${PURCHASE_ID}
