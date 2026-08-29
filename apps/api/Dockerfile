ARG DEPS_TAG
FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

FROM nest-seed-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN pnpm --filter './libs/common' --fail-if-no-match run build

COPY apps/api/ apps/api/
RUN pnpm --filter './apps/api' --fail-if-no-match run build
# pnpm의 isolated node_modules 링크를 평탄화하지 않고 API 전용 production tree로 배포한다.
RUN HUSKY=0 pnpm --filter './apps/api' --fail-if-no-match deploy --prod --legacy /workspace/deploy/api

FROM runtime-base AS runtime
WORKDIR /workspace/apps/api
COPY --from=build /workspace/deploy/api/package.json ./
COPY --from=build /workspace/deploy/api/node_modules ./node_modules
COPY --from=build /workspace/apps/api/_output/dist/index.js /workspace/apps/api/_output/dist/index.js.map _output/dist/

RUN install -d -o node -g node /app/logs
USER node

CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
