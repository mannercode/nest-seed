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

# 결제자는 본문이 아니라 인증 토큰의 주체로 정해진다(본문에 userId를 받지 않는다).
TEST "선점한 티켓 묶음을 구매한다" \
	201 POST /purchases \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H 'Content-Type: application/json' \
	-d '{
			"totalPrice": 20000,
			"purchaseItems": [
				{ "type": "tickets", "itemId": "'${TICKET_ID_1}'" },
				{ "type": "tickets", "itemId": "'${TICKET_ID_2}'" }
			]
		}'

# 자동 Bearer 주입을 끊어 "인증 없이" 케이스가 실제로 토큰 없이 호출되게 한다.
CURRENT_AUTH_TOKEN=""

TEST "인증 없이 구매하면 401을 반환한다" \
	401 POST /purchases \
	-H 'Content-Type: application/json' \
	-d '{
			"totalPrice": 20000,
			"purchaseItems": [
				{ "type": "tickets", "itemId": "'${TICKET_ID_1}'" }
			]
		}'

# 구매 기록은 본인 것만 조회된다(GET /users/me/purchases).
TEST "본인 구매 기록을 조회한다" \
	200 GET /users/me/purchases \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
