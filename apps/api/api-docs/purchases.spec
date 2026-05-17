#!/bin/bash
. ./common.fixture

login_admin
setup_showtime_resources

create_and_login_user
wait_for_tickets

SETUP POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{ "ticketIds": ["'${TICKET_ID_1}'", "'${TICKET_ID_2}'"] }'

TEST "선점한 티켓 묶음을 구매한다" \
	201 POST /purchases \
	-H 'Content-Type: application/json' \
	-d '{
			"userId": "'${USER_ID}'",
			"totalPrice": 20000,
			"purchaseItems": [
				{ "type": "tickets", "itemId": "'${TICKET_ID_1}'" },
				{ "type": "tickets", "itemId": "'${TICKET_ID_2}'" }
			]
		}'

PURCHASE_ID=$(echo "${BODY}" | jq -r '.id')

TEST "구매 기록을 조회한다" \
	200 GET /purchases/${PURCHASE_ID}
