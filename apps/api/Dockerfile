ARG DEPS_TAG
FROM nest-seed-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api
# devDependency 제거는 build 단계에서 합니다. 워크스페이스 그래프(root,
# `tools/*`, `libs/*`, `apps/api`)가 그대로 남아 있어야 `npm prune`이
# `@mannercode/*` 같은 워크스페이스 의존을 registry 조회 없이 풀 수 있습니다.
# runtime 단계는 root `package.json`이 없으므로, 같은 명령을 거기서 실행하면
# 그래프를 해석하지 못해 404로 실패합니다.
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
