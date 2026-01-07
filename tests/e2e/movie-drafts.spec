#!/bin/bash

DRAFT_ID=$(create_movie_draft)

TEST "Get Movie Draft" \
    200 GET /movie-drafts/${DRAFT_ID}

update_movie_draft "${DRAFT_ID}"

TEST "Get Movie Draft After Update" \
    200 GET /movie-drafts/${DRAFT_ID}

READY_ASSET_ID=$(create_and_upload_movie_draft_asset "${DRAFT_ID}")
complete_movie_draft_asset "${DRAFT_ID}" "${READY_ASSET_ID}"

MOVIE_ID=$(complete_movie_draft "${DRAFT_ID}")

DELETE_DRAFT_ID=$(create_movie_draft)

TEST "Create Movie Draft Asset for Delete" \
    201 POST /movie-drafts/${DELETE_DRAFT_ID}/assets \
    -H 'Content-Type: application/json' \
    -d "$(asset_payload)"

DELETE_ASSET_ID=$(echo ${BODY} | jq -r '.assetId')

TEST "Delete Movie Draft Asset" \
    204 DELETE /movie-drafts/${DELETE_DRAFT_ID}/assets/${DELETE_ASSET_ID}

TEST "Delete Movie Draft" \
    204 DELETE /movie-drafts/${DELETE_DRAFT_ID}
