FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/microservices/package.json libs/microservices/
COPY apis/msa/package.json apis/msa/
RUN npm install

COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build

COPY apis/jest.*.js apis/
COPY apis/msa/ apis/msa/
RUN TARGET_APP=${TARGET_APP} npm run bundle --workspace=apis/msa
RUN cp /monorepo/apis/msa/_output/dist/${TARGET_APP}/index.js /monorepo/apis/msa/_output/dist/index.js
RUN node apis/msa/scripts/bundle-workflows.js

FROM node:24-slim AS runtime

ENV LANG=C.UTF-8
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force
WORKDIR /monorepo/apis/msa
COPY --from=build /monorepo/package.json /monorepo/
COPY --from=build /monorepo/libs/common/package.json /monorepo/libs/common/
COPY --from=build /monorepo/libs/common/_output/dist/ /monorepo/libs/common/_output/dist/
COPY --from=build /monorepo/libs/microservices/package.json /monorepo/libs/microservices/
COPY --from=build /monorepo/libs/microservices/_output/dist/ /monorepo/libs/microservices/_output/dist/
COPY --from=build /monorepo/apis/msa/package.json /monorepo/apis/msa/
RUN npm install --omit=dev --prefix /monorepo
COPY --from=build /monorepo/apis/msa/_output/dist/index.js _output/dist/index.js
COPY --from=build /monorepo/apis/msa/_output/dist/workflow-bundle.js _output/dist/workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
