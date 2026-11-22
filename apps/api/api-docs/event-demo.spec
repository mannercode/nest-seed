TEST "인증 없이 이벤트를 발행하면 401을 반환한다" \
    401 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

create_and_login_user

TEST "메시지를 JetStream에 저장하면 이벤트 ID와 202를 반환한다" \
    202 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

TEST "메시지가 빈 문자열이면 400을 반환한다" \
    400 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "" }'

# 개발 API에서 SSE 수신 확인
# 로그인 응답의 accessToken을 두 터미널의 USER_ACCESS_TOKEN에 설정한다.
#
# 첫 번째 터미널에서 SSE 연결을 열어 둔다.
# curl -N "http://localhost:${API_PORT}/event-demo/event-stream" \
#     -H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
#
# 두 번째 터미널에서 메시지를 보내면 첫 번째 터미널에 "hello event"가 표시된다.
# curl -X POST "http://localhost:${API_PORT}/event-demo/messages" \
#     -H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
#     -H 'Content-Type: application/json' -d '{ "message": "hello event" }'
