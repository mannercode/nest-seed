#!/usr/bin/env bash
# Compute DEPS_TAG (lockfile + deps.Dockerfile hash) and ensure the image
# is available locally — pull from ghcr first, fall back to a local build
# if the tag is missing or auth is unavailable. Sets DEPS_TAG and
# DEPS_IMAGE for downstream `docker compose` build args.
#
# Tag formula must stay identical to .github/workflows/build-deps-image.yaml
# — diverging breaks ghcr cache hits.
#
# Usage: REPO_ROOT=/abs/path source apps/api/scripts/ensure-deps-image.sh

: "${REPO_ROOT:?REPO_ROOT must be set before sourcing this script}"

export DEPS_TAG=$(cat "${REPO_ROOT}/package-lock.json" "${REPO_ROOT}/apps/api/deps.Dockerfile" | sha256sum | cut -c1-16)
export DEPS_IMAGE="ghcr.io/mannercode/nest-seed/api-deps:${DEPS_TAG}"

if ! docker image inspect "$DEPS_IMAGE" >/dev/null 2>&1; then
    if ! docker pull "$DEPS_IMAGE" 2>/dev/null; then
        echo "Deps image not in ghcr (or no auth); building locally."
        docker build \
            -f "${REPO_ROOT}/apps/api/deps.Dockerfile" \
            -t "$DEPS_IMAGE" \
            "${REPO_ROOT}"
    fi
fi
