FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm install @mannercode/common @mannercode/microservice @mannercode/testing
COPY . .
RUN node -e "\
  const fs=require('fs');\
  const tc=JSON.parse(fs.readFileSync('tsconfig.json'));\
  Object.keys(tc.compilerOptions.paths).filter(k=>k.startsWith('@mannercode/')).forEach(k=>delete tc.compilerOptions.paths[k]);\
  tc.include=tc.include.filter(p=>!p.startsWith('../../'));\
  delete tc.compilerOptions.ignoreDeprecations;\
  fs.writeFileSync('tsconfig.json',JSON.stringify(tc,null,4));"
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
RUN npm install @mannercode/common @mannercode/microservice @mannercode/testing
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js
COPY --from=build /app/_output/dist/workflow-bundle.js /app/_output/dist/workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
