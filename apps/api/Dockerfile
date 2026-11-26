# syntax=docker/dockerfile:1

FROM node:26.13-slim AS base

FROM base AS build

ENV pnpm_config_store_dir=/pnpm/store

WORKDIR /workspace
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')"
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY tools/ tools/

# install 결과는 image layer에 남고, registry fetch 재시도는 pnpm의 기본 정책에 맡긴다.
RUN --mount=type=cache,id=nest-seed-pnpm,target=$pnpm_config_store_dir,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/api...' --filter './libs/common'

COPY libs/common/ libs/common/
RUN pnpm --filter './libs/common' --fail-if-no-match run build

COPY apps/api/nest-cli.json apps/api/rspack.config.cjs apps/api/tsconfig*.json apps/api/
COPY apps/api/src/ apps/api/src/
RUN pnpm --filter './apps/api' --fail-if-no-match run build
# pnpm의 isolated node_modules 링크를 평탄화하지 않고 API 전용 production tree로 배포한다.
RUN --mount=type=cache,id=nest-seed-pnpm,target=$pnpm_config_store_dir,sharing=locked \
    HUSKY=0 pnpm --filter './apps/api' --fail-if-no-match deploy --prod --legacy /workspace/deploy/api

FROM base AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/apps/api
COPY --from=build /workspace/deploy/api/package.json ./
COPY --from=build /workspace/deploy/api/node_modules ./node_modules
COPY --from=build /workspace/apps/api/_output/dist/ _output/dist/

USER node

# npm start는 셸을 거치므로 docker stop의 SIGTERM이 Node까지 전달되지 않을 수 있다.
# Node를 직접 실행해 Nest가 종료 훅에서 연결을 정리할 수 있게 한다.
CMD ["node", "--enable-source-maps", "_output/dist/index.js"]
