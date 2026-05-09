ARG DEPS_TAG
FROM ghcr.io/mannercode/nest-seed/api-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api
# devDeps 제거는 build stage 에서 수행한다. workspace 그래프 (root + tools/* + libs/* +
# apps/api) 가 모두 살아 있는 상태라야 npm prune 이 @mannercode/* 같은 workspace
# devDep 을 registry 조회 없이 정상 처리한다. runtime stage 는 root 가 없는
# bare /workspace/apps/api 라 prune 이 그래프를 못 풀어 404 로 깨진다.
RUN npm prune --omit=dev

FROM node:24-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
COPY --from=build /workspace/node_modules /workspace/node_modules
COPY --from=build /workspace/apps/api/_output/dist/index.js _output/dist/index.js
COPY --from=build /workspace/apps/api/_output/dist/showtime-creation-workflow-bundle.js _output/dist/showtime-creation-workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
