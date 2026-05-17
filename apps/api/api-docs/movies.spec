#!/bin/bash
. ./common.fixture

login_admin

TEST "영화를 생성한다" \
	201 POST /movies \
	-H 'Content-Type: application/json' \
	-d '{
			"title": "영화 제목",
			"genres": ["action", "drama"],
			"releaseDate": "2024-01-01T00:00:00.000Z",
			"plot": "API 문서 흐름 검증용 줄거리",
			"durationInSeconds": 7200,
			"director": "감독 이름",
			"rating": "PG",
			"assetIds": []
		}'

MOVIE_ID=$(echo "${BODY}" | jq -r '.id')

TEST "빈 요청 본문으로 영화 생성 기본값을 확인한다" \
	201 POST /movies \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST "영화 목록을 조회한다" \
	200 GET /movies

TEST "존재하지 않는 영화를 조회하면 404를 반환한다" \
	404 GET /movies/000000000000000000000000

TEST "영화 정보를 수정한다" \
	200 PATCH /movies/${MOVIE_ID} \
	-H 'Content-Type: application/json' \
	-d '{
			"plot": "수정된 영화 줄거리",
			"director": "수정된 감독 이름"
		}'

TEST "존재하지 않는 영화를 수정하면 404를 반환한다" \
	404 PATCH /movies/000000000000000000000000 \
	-H 'Content-Type: application/json' \
	-d '{ "plot": "x" }'

TEST "영화를 공개 상태로 변경한다" \
	200 POST /movies/${MOVIE_ID}/publish

TEST "영화 에셋 업로드 정보를 생성한다" \
	201 POST /movies/${MOVIE_ID}/assets \
	-H 'Content-Type: application/json' \
	-d '{
			"originalName": "'${ASSET_IMAGE_ORIGINAL_NAME}'",
			"mimeType": "image/png",
			"size": '${ASSET_IMAGE_SIZE}',
			"checksum": {
				"algorithm": "sha256",
				"base64": "'${ASSET_IMAGE_SHA256_BASE64}'"
			}
		}'

ASSET_ID=$(echo "${BODY}" | jq -r '.assetId')

LOG_LINE "# 프리사인드 POST 업로드"
upload_presigned_post "${ASSET_IMAGE_PATH}" "${BODY}"
LOG_LINE ""

TEST "영화 에셋 업로드 완료를 확정한다" \
	204 POST /movies/${MOVIE_ID}/assets/${ASSET_ID}/finalize

TEST "영화 상세 정보를 조회한다" \
	200 GET /movies/${MOVIE_ID}

TEST "영화 에셋을 삭제한다" \
	204 DELETE /movies/${MOVIE_ID}/assets/${ASSET_ID}

TEST "영화를 삭제한다" \
	204 DELETE /movies/${MOVIE_ID}

# 추천 엔드포인트는 user-optional 가드라 admin 토큰을 보내면 신뢰 영역이
# 어긋나 500이 된다. 게스트 호출을 보이려고 자동 주입을 비활성한다.
CURRENT_AUTH_TOKEN=""

TEST "추천 영화를 조회한다" \
	200 GET /movies/recommended
