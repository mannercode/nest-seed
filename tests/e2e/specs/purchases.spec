#!/bin/bash
. ./_common.fixture

create_and_login_customer
setup_showtime_resources
wait_for_tickets

SETUP POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
	-H "Authorization: Bearer ${CUSTOMER_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{ "ticketIds": ["'${TICKET_ID_1}'", "'${TICKET_ID_2}'"] }'

TEST "Create a purchase" \
	201 POST /purchases \
	-H 'Content-Type: application/json' \
	-d '{
			"customerId": "'${CUSTOMER_ID}'",
			"totalPrice": 20000,
			"purchaseItems": [
				{ "type": "ticket", "ticketId": "'${TICKET_ID_1}'" },
				{ "type": "ticket", "ticketId": "'${TICKET_ID_2}'" }
			]
		}'

PURCHASE_ID=$(echo "${BODY}" | jq -r '.id')
PAYMENT_ID=$(echo "${BODY}" | jq -r '.paymentId')

if [[ -z "${PAYMENT_ID}" || "${PAYMENT_ID}" == "null" ]]; then
	echo "# Setup failed: paymentId was not created" >&2
	echo "RES='invalid-payment-id'" >&2
	echo "${BODY}" | jq '.' >&2 || echo "${BODY}" >&2
	echo "'" >&2
	echo "" >&2
	exit 2
fi

TEST "Retrieve purchase by ID" \
	200 GET /purchases/${PURCHASE_ID}
