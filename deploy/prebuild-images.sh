#!/usr/bin/env bash
# Stability의 반복 테스트가 시작되기 전에 deploy 이미지를 한 번만 준비한다.
# 각 반복은 이 이미지를 --no-build로 재사용해 Docker Hub 메타데이터 조회를 반복하지 않는다.

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"

COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"

docker compose --project-directory "${COMPOSE_DIR}" -f "${COMPOSE_DIR}/compose.yml" build api
docker compose --project-directory "${COMPOSE_DIR}" -f "${COMPOSE_DIR}/compose.yml" pull nginx
