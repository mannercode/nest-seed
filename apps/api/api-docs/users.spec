USER_EMAIL=$(random_email)

TEST "회원가입에 쓸 사진의 업로드 조건을 발급받는다" \
	201 POST /users/photo-upload \
	-H 'Content-Type: application/json' \
	-d @./assets/image.json

PHOTO_UPLOAD="${BODY}"

PHOTO_ASSET_ID=$(RESPONSE_BODY assetId)

SIGNUP_BODY='{
    "name": "사용자 이름",
    "birthDate": "1990-01-01",
    "email": "'"${USER_EMAIL}"'",
    "password": "'"${USER_PASSWORD}"'",
    "photoAssetId": "'"${PHOTO_ASSET_ID}"'"
}'

TEST "아직 업로드하지 않은 사진 ID로 가입하면 422를 반환한다" \
	422 POST /users \
	-H 'Content-Type: application/json' -d "${SIGNUP_BODY}"

upload_presigned_post ./assets/image.png "${PHOTO_UPLOAD}"

TEST "사진을 첨부해 회원가입한다" \
	201 POST /users \
	-H 'Content-Type: application/json' -d "${SIGNUP_BODY}"

DUPLICATE_EMAIL_BODY=$(jq 'del(.photoAssetId)' <<<"${SIGNUP_BODY}")

TEST "등록된 이메일로 가입하면 409를 반환한다" \
	409 POST /users \
	-H 'Content-Type: application/json' -d "${DUPLICATE_EMAIL_BODY}"

TEST "이메일과 비밀번호로 로그인한다" \
	200 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'"${USER_EMAIL}"'", "password": "'"${USER_PASSWORD}"'" }'

USER_REFRESH_TOKEN=$(RESPONSE_BODY refreshToken)

TEST "잘못된 비밀번호로 로그인하면 401을 반환한다" \
	401 POST /users/login \
	-H 'Content-Type: application/json' \
	-d '{ "email": "'${USER_EMAIL}'", "password": "incorrect password" }'

TEST "리프레시 토큰으로 새 액세스 토큰과 리프레시 토큰을 발급받는다" \
	200 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

USER_ACCESS_TOKEN=$(RESPONSE_BODY accessToken)
USER_REFRESH_TOKEN=$(RESPONSE_BODY refreshToken)

TEST "내 정보를 조회한다" \
	200 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "홈에서 내 정보와 가입할 때 첨부한 사진의 URL을 조회한다" \
	200 GET /views/web/home \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "내 정보를 수정한다" \
	200 PATCH /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
	-H "Content-Type: application/json" \
	-d '{ "name": "내가 바꾼 이름" }'

TEST "현재 세션에서 로그아웃한다" \
	204 POST /users/logout \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'${USER_REFRESH_TOKEN}'" }'

TEST "로그아웃한 세션의 리프레시 토큰으로 갱신하면 401을 반환한다" \
	401 POST /users/refresh \
	-H 'Content-Type: application/json' \
	-d '{ "refreshToken": "'"${USER_REFRESH_TOKEN}"'" }'

login_user

TEST "회원 탈퇴를 요청한다" \
	204 DELETE /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"

TEST "탈퇴 후 같은 토큰으로 내 정보를 조회하면 404를 반환한다" \
	404 GET /users/me \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
