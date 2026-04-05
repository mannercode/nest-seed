FROM node:24-alpine AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/microservices/package.json libs/microservices/
COPY libs/testing/package.json libs/testing/
COPY apps/mono/package.json apps/mono/
RUN npm install

COPY libs/ libs/
RUN npm run build --workspace=libs/common && \
    npm run build --workspace=libs/microservices && \
    npm run build --workspace=libs/testing

COPY apps/mono/ apps/mono/
RUN npm run bundle --workspace=apps/mono

RUN node -e "\
  const pkg = require('./apps/mono/package.json'); \
  delete pkg.dependencies['@mannercode/common']; \
  delete pkg.devDependencies; \
  require('fs').writeFileSync('/tmp/package.json', JSON.stringify(pkg, null, 2));"

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /tmp/package.json ./
RUN npm install --omit=dev
COPY --from=build /monorepo/apps/mono/_output/dist/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
