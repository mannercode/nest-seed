#!/usr/bin/env bash
# DEPS_TAG (lockfile + deps.Dockerfile 해시) 를 계산하고 deps base image 가
# 로컬 docker daemon 에 있는지 보장한다. 없으면 로컬에서 build.
#
# 모노레포 root 의 package-lock.json 을 모든 apps/* 가 공유하므로 npm ci 는
# 한 번만 수행하고 그 결과 (node_modules baked-in) 를 base image 로 만들어
# apps/*/Dockerfile 이 FROM 으로 받아 쓰는 구조다. 새 app 이 추가돼도 같은
# DEPS_IMAGE 를 FROM 으로 쓰면 된다.
#
# 하위 `docker compose` 가 build args 로 DEPS_TAG / DEPS_IMAGE 를 읽으므로
# 호출 측에서 sourcing 해서 export 효과를 보존해야 한다.
#
# WORKSPACE_ROOT 는 devcontainer.json 의 containerEnv 에서 자동 주입된다.
# 다른 환경에서 실행할 일이 생기면 그곳에서도 같은 변수를 export 해 둘 것.

: "${WORKSPACE_ROOT:?}"

export DEPS_TAG=$(cat "${WORKSPACE_ROOT}/package-lock.json" "${WORKSPACE_ROOT}/deps.Dockerfile" | sha256sum | cut -c1-16)
export DEPS_IMAGE="deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    # dod 환경에서 build context 를 호스트 경로로 줄 수 없으므로 (devcontainer
    # 안 경로는 호스트 docker daemon 이 모름) tar 로 stdin 전송한다.
    # .dockerignore 는 stdin 컨텍스트엔 적용 안 되므로 tar 단계에서 직접 exclude.
    tar c \
        --exclude='./node_modules' \
        --exclude='./.git' \
        --exclude='**/node_modules' \
        --exclude='**/_output' \
        --exclude='**/__tests__' \
        -C "${WORKSPACE_ROOT}" . | \
        docker build \
            -f deps.Dockerfile \
            -t "$DEPS_IMAGE" \
            -
fi
