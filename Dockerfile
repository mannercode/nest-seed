FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG APPNAME
ENV APP_NAME=$APPNAME
RUN APP_NAME=$APP_NAME npm run build

FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

ARG APPNAME
ENV APP_NAME=$APPNAME
COPY --from=build /app/_output/dist/${APP_NAME}/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
