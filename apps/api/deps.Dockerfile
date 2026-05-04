# node_modules 만 baked-in 한 base 이미지. lockfile hash 를 태그로 ghcr 에
# publish (build-deps-image.yaml workflow). main Dockerfile 이 이걸 FROM 으로
# 받아 npm install 자체가 빌드 시점에 일어나지 않게 함.
FROM node:24-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
RUN npm ci --no-audit
