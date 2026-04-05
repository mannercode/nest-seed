FROM node:24-alpine AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/microservices/package.json libs/microservices/
COPY libs/testing/package.json libs/testing/
COPY apps/mono/package.json apps/mono/
RUN npm install

COPY libs/ libs/
RUN npm run build

COPY apps/mono/ apps/mono/
RUN npm run bundle --workspace=apps/mono

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /monorepo
COPY --from=build /monorepo/package.json ./
COPY --from=build /monorepo/libs/common/package.json libs/common/
COPY --from=build /monorepo/libs/common/dist/ libs/common/dist/
COPY --from=build /monorepo/libs/microservices/package.json libs/microservices/
COPY --from=build /monorepo/libs/microservices/dist/ libs/microservices/dist/
COPY --from=build /monorepo/libs/testing/package.json libs/testing/
COPY --from=build /monorepo/libs/testing/dist/ libs/testing/dist/
COPY --from=build /monorepo/apps/mono/package.json apps/mono/
RUN npm install --omit=dev
COPY --from=build /monorepo/apps/mono/_output/dist/index.js apps/mono/_output/dist/index.js

CMD ["node", "apps/mono/_output/dist/index.js"]
