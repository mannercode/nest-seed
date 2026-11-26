TEST "인증 없이 이벤트를 발행하면 401을 반환한다" \
    401 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

create_and_login_user

TEST "메시지를 발행하면 202를 반환한다" \
    202 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

TEST "메시지가 빈 문자열이면 400을 반환한다" \
    400 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "" }'

# 두 터미널에서 같은 API의 SSE 수신을 확인한다.
# 두 터미널 모두 SERVER_URL에 대상 API 주소를, USER_ACCESS_TOKEN에 같은 사용자의 accessToken을 넣는다.
#
# 첫 번째 터미널에서 SSE 연결을 열어 둔다.
# curl -N "${SERVER_URL}/event-demo/event-stream" \
#     -H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
#
# 두 번째 터미널에서 메시지를 보내면 첫 번째 터미널에 "hello event"가 표시된다.
# curl -X POST "${SERVER_URL}/event-demo/messages" \
#     -H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
#     -H 'Content-Type: application/json' -d '{ "message": "hello event" }'
