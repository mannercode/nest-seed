#!/usr/bin/env bash
# `DEPS_TAG`를 pnpm workspace/lockfile, `deps.Dockerfile`, 모든 workspace manifest의 해시로 정한다.
# 그 태그의 베이스 이미지가 이미 있으면 그대로 쓰고, 없으면 그 자리에서 빌드한다.
# 모노레포 루트의 lockfile을 모든 `apps/*`가 공유하므로, frozen install 결과를 한 번 굳혀 둔 베이스 이미지를 `apps/*/Dockerfile`이 `FROM`으로 받아 사용한다.
# 이 스크립트의 호출자는 `source`로 불러 `DEPS_TAG`와 `DEPS_IMAGE`를 받아, compose 빌드 인자로 넘긴다.

: "${WORKSPACE_ROOT:?}"

# 현재 규약인 apps/libs/tests/tools 바로 아래 한 단계의 workspace manifest를 모두 찾는다.
# 새 최상위 경로나 중첩 깊이를 도입하면 이 탐색 범위와 Dockerfile의 COPY를 함께 갱신해야 해시에 반영된다.
# Git metadata가 없는 source archive에서도 동작하도록 파일 시스템에서 찾는다.
mapfile -d '' -t PACKAGE_MANIFESTS < <(
    cd "${WORKSPACE_ROOT}" || exit 1
    {
        printf 'package.json\0'
        find apps libs tests tools -mindepth 2 -maxdepth 2 -type f -name package.json -print0
    } | sort -z
)
if [ "${#PACKAGE_MANIFESTS[@]}" -eq 0 ]; then
    echo "No tracked package manifests found" >&2
    return 1 2>/dev/null || exit 1
fi

DEPENDENCY_INPUTS=(
    deploy/deps.Dockerfile
    pnpm-lock.yaml
    pnpm-workspace.yaml
    tools/dev-tools/free-port.js
    tools/dev-tools/tunnel.sh
    "${PACKAGE_MANIFESTS[@]}"
)

# export와 할당을 한 줄에 쓰면 $(...)의 실패가 export의 성공으로 가려져, 빈 입력의 해시로 조용히 진행한다.
if ! DEPS_TAG=$(
    set -o pipefail
    cd "${WORKSPACE_ROOT}" || exit 1
    sha256sum "${DEPENDENCY_INPUTS[@]}" | sha256sum | cut -c1-16
); then
    echo "Failed to hash dependency image inputs" >&2
    return 1 2>/dev/null || exit 1
fi
export DEPS_TAG
export DEPS_IMAGE="nest-seed-deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    docker build -f "${WORKSPACE_ROOT}/deploy/deps.Dockerfile" -t "$DEPS_IMAGE" "${WORKSPACE_ROOT}"
fi
