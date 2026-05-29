ARG DEPS_TAG
FROM nest-seed-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
COPY tools/ tools/
RUN npm run build --workspace=libs/temporal-sandbox
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api
# devDependency 제거는 build 단계에서 한다.
# 워크스페이스 그래프(root, `tools/*`, `libs/*`, `apps/api`)가 그대로 남아 있어야 `npm prune`이 `@mannercode/*` 같은 워크스페이스 의존을 registry 조회 없이 풀 수 있다.
# runtime 단계는 root `package.json`이 없으므로, 같은 명령을 거기서 실행하면 그래프를 해석하지 못해 404로 실패한다.
RUN npm prune --omit=dev

FROM node:24-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
COPY --from=build /workspace/node_modules /workspace/node_modules
# `@mannercode/temporal-sandbox`는 webpack external로 두어, 런타임에 SDK가 node_modules의 워크스페이스 심볼릭 링크를 따라 실제 디스크 경로로 컨버터 모듈을 require한다.
# 그래서 패키지 manifest와 빌드 결과를 함께 복사해야 링크가 유효해진다.
COPY --from=build /workspace/libs/temporal-sandbox/package.json /workspace/libs/temporal-sandbox/
COPY --from=build /workspace/libs/temporal-sandbox/_output/dist /workspace/libs/temporal-sandbox/_output/dist
COPY --from=build /workspace/apps/api/_output/dist/index.js _output/dist/index.js
COPY --from=build /workspace/apps/api/_output/workflows/ _output/workflows/

# 컨테이너를 root로 돌리면 앱 침해 시 컨테이너 root까지 노출된다.
# node:24-slim에 내장된 비-root node(uid 1000)로 떨어뜨린다.
# 단, 로거(LOG_DIRECTORY=/app/logs)는 USER 전환 후 디렉터리를 직접 만들 수 없으므로 미리 만들어 소유권을 넘긴다.
RUN mkdir -p /app/logs && chown -R node:node /app/logs /workspace
USER node

CMD ["node", "_output/dist/index.js"]
