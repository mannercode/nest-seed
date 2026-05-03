# node:24-slim (Debian/glibc) over alpine: @temporalio/core-bridge is a
# native Rust addon that ships only x86_64-unknown-linux-gnu (glibc)
# binaries, so it fails to load on alpine's musl with `Error loading
# shared library ld-linux-x86-64.so.2`.
FROM node:24-slim AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
RUN npm install

COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build

COPY apps/api/ apps/api/
RUN npm run bundle --workspace=apps/api

FROM node:24-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /monorepo/apps/api
COPY --from=build /monorepo/apps/api/package.json /monorepo/apps/api/
RUN cd /monorepo/apps/api && npm install --omit=dev
COPY --from=build /monorepo/apps/api/_output/dist/index.js _output/dist/index.js
# Pre-bundled workflow code produced by scripts/bundle-workflows.js. The
# runtime resolves it via TemporalWorkerOptions.workflowBundlePath because
# require.resolve against source paths fails after webpack rolls the app
# into a single index.js.
COPY --from=build /monorepo/apps/api/_output/dist/showtime-creation-workflow-bundle.js _output/dist/showtime-creation-workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
