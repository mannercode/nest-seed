ARG APP_IMAGE

FROM ${APP_IMAGE} AS build
ARG APP_NAME

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN APP_NAME=$APP_NAME npm run build

FROM ${APP_IMAGE}
ARG APP_NAME

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/_output/dist/${APP_NAME}/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
