FROM node:24-alpine AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
RUN npm install

COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build

COPY apps/api/ apps/api/
RUN npm run bundle --workspace=apps/api

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /monorepo/apps/api
COPY --from=build /monorepo/apps/api/package.json /monorepo/apps/api/
RUN cd /monorepo/apps/api && npm install --omit=dev
COPY --from=build /monorepo/apps/api/_output/dist/index.js _output/dist/index.js

CMD ["node", "_output/dist/index.js"]
