FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/microservices/package.json libs/microservices/
COPY apps/msa/package.json apps/msa/
RUN npm install

COPY libs/ libs/
RUN npm run build

COPY apps/msa/ apps/msa/
RUN TARGET_APP=${TARGET_APP} npm run bundle --workspace=apps/msa
RUN cp /monorepo/apps/msa/_output/dist/${TARGET_APP}/index.js /monorepo/apps/msa/_output/dist/index.js
RUN node apps/msa/scripts/bundle-workflows.js

FROM node:24-slim AS runtime

ENV LANG=C.UTF-8
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force
WORKDIR /monorepo
COPY --from=build /monorepo/package.json ./
COPY --from=build /monorepo/libs/common/package.json libs/common/
COPY --from=build /monorepo/libs/common/dist/ libs/common/dist/
COPY --from=build /monorepo/libs/microservices/package.json libs/microservices/
COPY --from=build /monorepo/libs/microservices/dist/ libs/microservices/dist/
COPY --from=build /monorepo/apps/msa/package.json apps/msa/
RUN npm install --omit=dev
COPY --from=build /monorepo/apps/msa/_output/dist/index.js apps/msa/_output/dist/index.js
COPY --from=build /monorepo/apps/msa/_output/dist/workflow-bundle.js apps/msa/_output/dist/workflow-bundle.js

CMD ["node", "apps/msa/_output/dist/index.js"]
