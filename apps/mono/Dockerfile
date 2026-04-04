FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
