#!/usr/bin/env bash
# Stability의 반복 테스트가 시작되기 전에 deploy 이미지를 한 번만 준비한다.
# 각 반복은 이 이미지를 --no-build로 재사용해 Docker Hub 메타데이터 조회를 반복하지 않는다.

set -Eeuo pipefail

: "${WORKSPACE_ROOT:?}"

COMPOSE_DIR="${WORKSPACE_ROOT}/deploy"
MAX_ATTEMPTS=3

prebuild_images_once() {
    docker compose --project-directory "${COMPOSE_DIR}" -f "${COMPOSE_DIR}/compose.yml" build api || return 1
    docker compose --project-directory "${COMPOSE_DIR}" -f "${COMPOSE_DIR}/compose.yml" pull nginx || return 1
}

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
    echo "Prebuilding deploy images (attempt ${attempt}/${MAX_ATTEMPTS})..."
    if prebuild_images_once; then
        echo "Deploy images are ready"
        exit 0
    fi

    if [ "${attempt}" -eq "${MAX_ATTEMPTS}" ]; then
        echo "[FAIL] deploy image prebuild failed after ${MAX_ATTEMPTS} attempts" >&2
        exit 1
    fi

    delay=$((attempt * 10))
    echo "Deploy image prebuild failed; retrying in ${delay}s..." >&2
    sleep "${delay}"
done
