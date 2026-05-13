#!/bin/bash
. ./common.fixture

TEST 201 POST /movies \
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

TEST 201 POST /movies \
	-H 'Content-Type: application/json' \
	-d '{}'

TEST 200 GET /movies

TEST 404 GET /movies/000000000000000000000000

TEST 200 PATCH /movies/${MOVIE_ID} \
	-H 'Content-Type: application/json' \
	-d '{
			"plot": "수정된 영화 줄거리",
			"director": "수정된 감독 이름"
		}'

TEST 404 PATCH /movies/000000000000000000000000 \
	-H 'Content-Type: application/json' \
	-d '{ "plot": "x" }'

TEST 200 POST /movies/${MOVIE_ID}/publish

TEST 201 POST /movies/${MOVIE_ID}/assets \
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

TEST 204 POST /movies/${MOVIE_ID}/assets/${ASSET_ID}/finalize

TEST 200 GET /movies/${MOVIE_ID}

TEST 204 DELETE /movies/${MOVIE_ID}/assets/${ASSET_ID}

TEST 204 DELETE /movies/${MOVIE_ID}

TEST 200 GET /movies/recommended
