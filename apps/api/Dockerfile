# node:24-slim (Debian/glibc) over alpine: @temporalio/core-bridge is a
# native Rust addon that ships only x86_64-unknown-linux-gnu (glibc)
# binaries, so it fails to load on alpine's musl with `Error loading
# shared library ld-linux-x86-64.so.2`.
#
# DEPS_TAG = sha256(package-lock.json) prefix. The api-deps image is
# built and pushed by .github/workflows/build-deps-image.yaml whenever
# the lockfile (or any workspace package.json) changes; here we just
# pull it. No npm install at build time → no network for deps → no
# ECONNRESET, no Docker-Hub rate limit, no buildx cache plumbing.
ARG DEPS_TAG
FROM ghcr.io/mannercode/api-deps:${DEPS_TAG} AS build

# node_modules is already baked into the deps image; only the source
# tree needs copying in.
COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api

FROM ghcr.io/mannercode/mirror/node:24-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
# Reuse the build stage's already-installed node_modules and prune dev
# deps locally — no network, fully offline.
COPY --from=build /workspace/node_modules /workspace/node_modules
RUN npm prune --omit=dev
COPY --from=build /workspace/apps/api/_output/dist/index.js _output/dist/index.js
# Pre-bundled workflow code produced by scripts/bundle-workflows.js. The
# runtime resolves it via TemporalWorkerOptions.workflowBundlePath because
# require.resolve against source paths fails after webpack rolls the app
# into a single index.js.
COPY --from=build /workspace/apps/api/_output/dist/showtime-creation-workflow-bundle.js _output/dist/showtime-creation-workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
