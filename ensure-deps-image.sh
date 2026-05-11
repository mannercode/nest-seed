#!/usr/bin/env bash
# DEPS_TAG (lockfile + deps.Dockerfile 해시) 로 deps base image 가 이미 있는지
# 보고, 없으면 build. 모노레포 root lockfile 을 모든 apps/* 가 공유하므로 npm
# ci 결과를 한 번 baked-in 해서 apps/*/Dockerfile 의 FROM 으로 쓴다.
# 호출 측이 source 해서 DEPS_TAG / DEPS_IMAGE 를 받아 compose build args 로 넘긴다.

: "${WORKSPACE_ROOT:?}"

export DEPS_TAG=$(cat "${WORKSPACE_ROOT}/package-lock.json" "${WORKSPACE_ROOT}/deps.Dockerfile" | sha256sum | cut -c1-16)
export DEPS_IMAGE="deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    docker build -f "${WORKSPACE_ROOT}/deps.Dockerfile" -t "$DEPS_IMAGE" "${WORKSPACE_ROOT}"
fi
