ARG DEPS_TAG
FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS runtime-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

FROM nest-seed-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN npm run build --workspace=libs/temporal-sandbox
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api
# prune가 API 런타임에 필요한 workspace만 따라가도록 목록을 줄인 뒤 production 의존성만 남긴다.
RUN npm pkg set 'workspaces=["apps/api","libs/common","libs/temporal-sandbox"]' --json \
    && npm prune --omit=dev --no-audit --no-fund

FROM runtime-base AS runtime
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
COPY --from=build /workspace/node_modules /workspace/node_modules
# runtime workspace 링크 대상의 manifest와 빌드 결과를 함께 복사한다.
COPY --from=build /workspace/libs/temporal-sandbox/package.json /workspace/libs/temporal-sandbox/
COPY --from=build /workspace/libs/temporal-sandbox/_output/dist /workspace/libs/temporal-sandbox/_output/dist
COPY --from=build /workspace/apps/api/_output/dist/index.js /workspace/apps/api/_output/dist/index.js.map _output/dist/
COPY --from=build /workspace/apps/api/_output/workflows/ _output/workflows/

RUN install -d -o node -g node /app/logs
USER node

CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
