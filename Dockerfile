FROM node:22-alpine AS build
ARG APP_NAME

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN APP_NAME=$APP_NAME npm run build

FROM node:22-alpine
ARG APP_NAME

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/_output/dist/${APP_NAME}/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
