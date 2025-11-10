FROM node:24-alpine AS build

ARG TARGET_APP
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN TARGET_APP=${TARGET_APP} npm run build
RUN cp /app/_output/dist/${TARGET_APP}/index.js /app/_output/dist/index.js

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
