FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm install @mannercode/common @mannercode/testing
COPY . .
RUN node -e "\
  const fs=require('fs');\
  const tc=JSON.parse(fs.readFileSync('tsconfig.json'));\
  Object.keys(tc.compilerOptions.paths).filter(k=>k.startsWith('@mannercode/')).forEach(k=>delete tc.compilerOptions.paths[k]);\
  tc.include=tc.include.filter(p=>!p.startsWith('../../'));\
  delete tc.compilerOptions.ignoreDeprecations;\
  fs.writeFileSync('tsconfig.json',JSON.stringify(tc,null,4));"
RUN npm run build

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN npm install @mannercode/common @mannercode/testing
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
