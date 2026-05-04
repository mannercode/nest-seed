ARG DEPS_TAG
FROM ghcr.io/mannercode/api-deps:${DEPS_TAG} AS build

COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build --workspace=libs/common

COPY apps/api/ apps/api/
RUN npm run build --workspace=apps/api

FROM node:24-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/apps/api
COPY --from=build /workspace/apps/api/package.json /workspace/apps/api/
COPY --from=build /workspace/node_modules /workspace/node_modules
RUN npm prune --omit=dev
COPY --from=build /workspace/apps/api/_output/dist/index.js _output/dist/index.js
COPY --from=build /workspace/apps/api/_output/dist/showtime-creation-workflow-bundle.js _output/dist/showtime-creation-workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
