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

# TODO 주석으로 하지 말고 이벤트를 계속 보내는 api 하나 만드는게 어떤가
#
# SSE 수신을 직접 확인하는 방법
# 1. 첫 번째 터미널에서 로그인할 때 받은 토큰으로 연결을 열어 둔다.
#    curl -N -H "Authorization: Bearer ${USER_ACCESS_TOKEN}" "${SERVER_URL}/event-demo/event-stream"
# 2. 두 번째 터미널에서 같은 계정으로 POST /event-demo/messages에 "hello event"를 보낸다.
#    첫 번째 터미널에 그 메시지가 표시된다.
