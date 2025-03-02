ARG APP_IMAGE

FROM ${APP_IMAGE} AS build
ARG TARGET_APP

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN TARGET_APP=$TARGET_APP npm run build

FROM ${APP_IMAGE}
ARG TARGET_APP

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/_output/dist/${TARGET_APP}/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
