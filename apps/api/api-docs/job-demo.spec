TEST "인증 없이 작업을 제출하면 401을 반환한다" \
    401 POST /job-demo/jobs \
    -H 'Content-Type: application/json' -d '{ "text": "Hello seed" }'

create_and_login_user

TEST "대문자 변환 작업을 접수하면 작업 ID와 202를 반환한다" \
    202 POST /job-demo/jobs \
    -H 'Content-Type: application/json' -d '{ "text": "Hello seed" }'

JOB_ID=$(RESPONSE_BODY jobId)

TEST "접수한 작업을 ID로 조회한다" \
    200 GET "/job-demo/jobs/${JOB_ID}"

create_and_login_user

TEST "다른 사용자의 작업은 조회할 수 없다" \
    404 GET "/job-demo/jobs/${JOB_ID}"
