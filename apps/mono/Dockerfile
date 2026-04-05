FROM node:24-alpine AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY apps/mono/package.json apps/mono/
RUN npm install

COPY libs/ libs/
RUN npm run build

COPY apps/mono/ apps/mono/
RUN npm run bundle --workspace=apps/mono

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /monorepo/apps/mono
COPY --from=build /monorepo/package.json /monorepo/
COPY --from=build /monorepo/libs/common/package.json /monorepo/libs/common/
COPY --from=build /monorepo/libs/common/dist/ /monorepo/libs/common/dist/
COPY --from=build /monorepo/apps/mono/package.json /monorepo/apps/mono/
RUN npm install --omit=dev --prefix /monorepo
COPY --from=build /monorepo/apps/mono/_output/dist/index.js _output/dist/index.js

CMD ["node", "_output/dist/index.js"]
