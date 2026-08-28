ARG DEPS_TAG
FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

FROM nest-seed-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api
# prune가 API 런타임에 필요한 workspace만 따라가도록 목록을 줄인 뒤 production 의존성만 남긴다.
RUN npm pkg set 'workspaces=["apps/api","libs/common"]' --json \
    && npm prune --omit=dev --no-audit --no-fund

FROM runtime-base AS runtime
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
COPY --from=build /workspace/node_modules /workspace/node_modules
COPY --from=build /workspace/apps/api/_output/dist/index.js /workspace/apps/api/_output/dist/index.js.map _output/dist/

RUN install -d -o node -g node /app/logs
USER node

CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
