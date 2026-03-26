FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
RUN npm install --legacy-peer-deps @mannercode/common @mannercode/testing
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
RUN npm run build

FROM node:24-alpine AS runtime

RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
RUN npm install --legacy-peer-deps @mannercode/common @mannercode/testing
COPY --from=build /app/_output/dist/index.js /app/_output/dist/index.js

CMD ["node", "_output/dist/index.js"]
