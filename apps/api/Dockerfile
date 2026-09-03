# syntax=docker/dockerfile:1

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS base

FROM base AS build

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/
COPY tools/vitest-helpers/package.json tools/vitest-helpers/

# BuildKit이 registry package store를 관리하고, install은 API 빌드에 필요한 workspace closure만 연결한다.
# npm registry의 일시적 연결 오류는 같은 frozen install을 최대 다섯 번 재시도한다.
RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    for attempt in 1 2 3 4 5; do \
        HUSKY=0 pnpm install --frozen-lockfile --filter './apps/api...' --filter './libs/common' --store-dir /pnpm/store && break; \
        [ "$attempt" = 5 ] && exit 1; \
        echo "pnpm install failed (attempt ${attempt}/5), retrying in $((attempt * 10))s..." >&2; \
        sleep $((attempt * 10)); \
    done

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
COPY --from=build /workspace/apps/api/_output/dist/index.js /workspace/apps/api/_output/dist/index.js.map _output/dist/

USER node

CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
