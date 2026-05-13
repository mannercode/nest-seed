#!/usr/bin/env bash
# `DEPS_TAG`를 lockfile과 `deps.Dockerfile`의 합본 해시로 정한다. 그 태그의
# 베이스 이미지가 이미 있으면 그대로 쓰고, 없으면 그 자리에서 빌드한다.
# 모노레포 루트의 lockfile을 모든 `apps/*`가 공유하므로, `npm ci` 결과를
# 한 번 굳혀 둔 베이스 이미지를 `apps/*/Dockerfile`이 `FROM`으로 받아 사용한다.
# 이 스크립트의 호출자는 `source`로 불러 `DEPS_TAG`와 `DEPS_IMAGE`를
# 받아, compose 빌드 인자로 넘긴다.

: "${WORKSPACE_ROOT:?}"

export DEPS_TAG=$(cat "${WORKSPACE_ROOT}/package-lock.json" "${WORKSPACE_ROOT}/deps.Dockerfile" | sha256sum | cut -c1-16)
export DEPS_IMAGE="nest-seed-deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    docker build -f "${WORKSPACE_ROOT}/deps.Dockerfile" -t "$DEPS_IMAGE" "${WORKSPACE_ROOT}"
fi
