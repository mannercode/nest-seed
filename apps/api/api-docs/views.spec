TEST "로그인 없이 홈을 조회하면 401을 반환한다" \
    401 GET /views/web/home

create_and_login_user

TEST "사진 없이 가입한 사용자가 홈에서 본인 정보를 조회한다" \
    200 GET /views/web/home
