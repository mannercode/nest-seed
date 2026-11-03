#!/bin/bash
. ./common.fixture

USER_EMAIL=$(random_email)
TEST "회원가입 사진의 업로드 조건을 발급한다" \
    201 POST /users/photo-upload \
    -H 'Content-Type: application/json' \
    -d '{
        "originalName": "'${ASSET_IMAGE_ORIGINAL_NAME}'",
        "mimeType": "image/png",
        "size": '${ASSET_IMAGE_SIZE}',
        "checksum": { "algorithm": "sha256", "base64": "'${ASSET_IMAGE_SHA256_BASE64}'" }
    }'
PHOTO_UPLOAD="${BODY}"
PHOTO_ASSET_ID=$(echo "${BODY}" | jq -r '.assetId')
SIGNUP_BODY=$(jq -n --arg email "${USER_EMAIL}" --arg photoAssetId "${PHOTO_ASSET_ID}" \
    '{ name: "사진 사용자", birthDate: "1990-01-01", email: $email, password: "Example password 1!", photoAssetId: $photoAssetId }')

TEST "파일 전송 전에 가입하면 422를 반환한다" \
    422 POST /users -H 'Content-Type: application/json' -d "${SIGNUP_BODY}"

upload_presigned_post "${ASSET_IMAGE_PATH}" "${PHOTO_UPLOAD}"
TEST "파일 전송을 마치면 사진과 계정을 함께 등록한다" \
    201 POST /users -H 'Content-Type: application/json' -d "${SIGNUP_BODY}"

login_user
TEST "홈에서 내 정보와 사진 URL을 조회한다" \
    200 GET /views/web/home
TEST "탈퇴하면 사진과 계정을 삭제한다" \
    204 DELETE /users/me
