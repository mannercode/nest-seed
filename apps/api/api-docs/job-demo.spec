#!/bin/bash
. ./common.fixture

TEST "인증 없이 작업을 제출하면 401을 반환한다" \
    401 POST /job-demo/jobs \
    -H 'Content-Type: application/json' -d '{ "text": "Hello seed" }'

create_and_login_user
TEST "대문자 변환 작업을 접수하면 작업 ID와 202를 반환한다" \
    202 POST /job-demo/jobs \
    -H 'Content-Type: application/json' -d '{ "text": "Hello seed" }'
JOB_ID=$(echo "${BODY}" | jq -r '.jobId')

# 응답은 실행 중이면 pending, 결과 저장까지 마쳤으면 completed와 result다.
for _attempt in {1..100}; do
    SETUP GET "/job-demo/jobs/${JOB_ID}"
    JOB_STATUS=$(echo "${BODY}" | jq -r '.status')
    if [[ "${JOB_STATUS}" == "completed" ]]; then
        break
    fi
    if [[ "${JOB_STATUS}" != "pending" ]]; then
        echo "Unexpected job status: ${JOB_STATUS}" >&2
        exit 1
    fi
    sleep 0.1
done
if [[ "${JOB_STATUS}" != "completed" ]]; then
    echo "Job ${JOB_ID} did not complete" >&2
    exit 1
fi
TEST "완료한 작업의 결과를 조회한다" \
    200 GET "/job-demo/jobs/${JOB_ID}"
echo "${BODY}" | jq -e '.result == { "text": "HELLO SEED", "characterCount": 10 }' >/dev/null

create_and_login_user
TEST "다른 사용자의 작업은 조회할 수 없다" \
    404 GET "/job-demo/jobs/${JOB_ID}"
