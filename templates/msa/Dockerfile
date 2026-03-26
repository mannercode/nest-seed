FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN TARGET_APP=${TARGET_APP} npm run build
RUN cp /app/_output/dist/${TARGET_APP}/index.js /app/_output/dist/index.js
RUN node scripts/bundle-workflows.js

FROM node:24-slim AS runtime

ENV LANG=C.UTF-8
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js
COPY --from=build /app/_output/dist/workflow-bundle.js /app/_output/dist/workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
