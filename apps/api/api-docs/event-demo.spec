#!/bin/bash
. ./common.fixture

TEST "인증 없이 이벤트를 발행하면 401을 반환한다" \
    401 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

create_and_login_user
TEST "메시지를 JetStream에 저장하면 이벤트 ID와 202를 반환한다" \
    202 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "hello event" }'

# 발행 전에 같은 사용자의 토큰으로 SSE에 연결하면 소비된 메시지를 받는다.
# curl -N -H "Authorization: Bearer ${USER_ACCESS_TOKEN}" "${SERVER_URL}/event-demo/event-stream"
TEST "빈 메시지는 발행하지 않는다" \
    400 POST /event-demo/messages \
    -H 'Content-Type: application/json' -d '{ "message": "" }'
