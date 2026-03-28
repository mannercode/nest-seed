FROM node:24-slim AS build

ENV LANG=C.UTF-8
ARG TARGET_APP
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
RUN npm install --legacy-peer-deps @mannercode/common @mannercode/microservice @mannercode/testing
COPY . .
RUN node -e "\
  const fs=require('fs');\
  const tc=JSON.parse(fs.readFileSync('tsconfig.json'));\
  Object.keys(tc.compilerOptions.paths).filter(k=>k.startsWith('@mannercode/')).forEach(k=>delete tc.compilerOptions.paths[k]);\
  tc.include=tc.include.filter(p=>!p.startsWith('../../'));\
  tc.compilerOptions.rootDir='.';\
  fs.writeFileSync('tsconfig.json',JSON.stringify(tc,null,4));\
  const bc=JSON.parse(fs.readFileSync('tsconfig.build.json'));\
  bc.exclude=bc.exclude.filter(p=>!p.startsWith('../../'));\
  bc.compilerOptions=bc.compilerOptions||{};\
  bc.compilerOptions.rootDir='src';\
  fs.writeFileSync('tsconfig.build.json',JSON.stringify(bc,null,4));"
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
RUN npm ci --omit=dev --legacy-peer-deps
RUN npm install --legacy-peer-deps @mannercode/common @mannercode/microservice @mannercode/testing
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js
COPY --from=build /app/_output/dist/workflow-bundle.js /app/_output/dist/workflow-bundle.js

CMD ["node", "_output/dist/index.js"]
