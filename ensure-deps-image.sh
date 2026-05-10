#!/usr/bin/env bash
# DEPS_TAG (lockfile + deps.Dockerfile 해시) 를 계산하고 image 가 로컬에
# 있는지 보장한다 — 우선 ghcr 에서 pull 하고, tag 가 없거나 auth 가 없으면
# 로컬 build 로 fallback 한다. 하위 `docker compose` build args 용으로
# DEPS_TAG 와 DEPS_IMAGE 를 export 한다.
#
# Tag 산출식은 .github/workflows/build-deps-image.yaml 과 반드시 동일해야
# 한다 — 어긋나면 ghcr cache hit 가 깨진다.
#
# WORKSPACE_ROOT 는 devcontainer.json 의 containerEnv 에서 자동 주입된다.
# 다른 환경에서 실행할 일이 생기면 그곳에서도 같은 변수를 export 해 둘 것.

: "${WORKSPACE_ROOT:?}"

export DEPS_TAG=$(cat "${WORKSPACE_ROOT}/package-lock.json" "${WORKSPACE_ROOT}/deps.Dockerfile" | sha256sum | cut -c1-16)
export DEPS_IMAGE="ghcr.io/mannercode/nest-seed/deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    if ! docker pull "$DEPS_IMAGE" 2>/dev/null; then
        echo "Deps image not in ghcr (or no auth); building locally."
        docker build \
            -f "${WORKSPACE_ROOT}/deps.Dockerfile" \
            -t "$DEPS_IMAGE" \
            "${WORKSPACE_ROOT}"
    fi
fi
