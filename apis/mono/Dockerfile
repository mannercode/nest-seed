FROM node:24-alpine AS build

WORKDIR /monorepo
COPY package.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apis/mono/package.json apis/mono/
RUN npm install

COPY tsconfig.json ./
COPY libs/ libs/
RUN npm run build

COPY apis/jest.*.js apis/
COPY apis/mono/ apis/mono/
RUN npm run bundle --workspace=apis/mono

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /monorepo/apis/mono
COPY --from=build /monorepo/apis/mono/package.json /monorepo/apis/mono/
RUN cd /monorepo/apis/mono && npm install --omit=dev
COPY --from=build /monorepo/apis/mono/_output/dist/index.js _output/dist/index.js

CMD ["node", "_output/dist/index.js"]
