FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/microservices/package.json libs/microservices/
COPY libs/testing/package.json libs/testing/
COPY apps/msa/package.json apps/msa/
RUN npm install

COPY libs/ libs/
RUN npm run build --workspace=libs/common && \
    npm run build --workspace=libs/microservices && \
    npm run build --workspace=libs/testing

COPY apps/msa/ apps/msa/
RUN TARGET_APP=${TARGET_APP} npm run bundle --workspace=apps/msa
RUN cp /monorepo/apps/msa/_output/dist/${TARGET_APP}/index.js /monorepo/apps/msa/_output/dist/index.js
RUN node apps/msa/scripts/bundle-workflows.js

RUN node -e "\
  const pkg = require('./apps/msa/package.json'); \
  delete pkg.dependencies['@mannercode/common']; \
  delete pkg.dependencies['@mannercode/microservices']; \
  delete pkg.devDependencies; \
  require('fs').writeFileSync('/tmp/package.json', JSON.stringify(pkg, null, 2));"

FROM node:24-slim AS runtime

ENV LANG=C.UTF-8
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force
WORKDIR /app
COPY --from=build /tmp/package.json ./
RUN npm install --omit=dev
COPY --from=build /monorepo/apps/msa/_output/dist/index.js /app/_output/dist/index.js
COPY --from=build /monorepo/apps/msa/_output/dist/workflow-bundle.js /app/_output/dist/workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
