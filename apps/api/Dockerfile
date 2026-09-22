# syntax=docker/dockerfile:1

FROM node:26.10.0-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2 AS base

FROM base AS build

RUN npm install -g pnpm@12.4.2

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/
COPY tools/vitest-helpers/package.json tools/vitest-helpers/

# install 결과는 image layer에 남고, registry fetch 재시도는 pnpm의 기본 정책에 맡긴다.
RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/api...' --filter './libs/common' --store-dir /pnpm/store

COPY tsconfig.json ./
COPY libs/common/ libs/common/
RUN pnpm --filter './libs/common' --fail-if-no-match run build

COPY apps/api/ apps/api/
RUN pnpm --filter './apps/api' --fail-if-no-match run build
# pnpm의 isolated node_modules 링크를 평탄화하지 않고 API 전용 production tree로 배포한다.
RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm --filter './apps/api' --fail-if-no-match deploy --prod --legacy --store-dir /pnpm/store /workspace/deploy/api

FROM base AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/apps/api
COPY --from=build /workspace/deploy/api/package.json ./
COPY --from=build /workspace/deploy/api/node_modules ./node_modules
COPY --from=build /workspace/apps/api/_output/dist/ _output/dist/
COPY --from=build /workspace/apps/api/scripts/admin-create.cjs scripts/admin-create.cjs

USER node

CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
