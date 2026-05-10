# node_modules 만 baked-in 한 base 이미지. ensure-deps-image.sh 가 lockfile +
# 이 Dockerfile 합본 hash 를 태그로 로컬 build 한다. apps/*/Dockerfile 이
# 이걸 FROM 으로 받아 npm install 이 main 빌드 시점에 일어나지 않게 함.
# 모노레포 워크스페이스가 단일 lockfile 을 공유하므로 base 는 하나면 충분.
FROM node:24-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
# tools/ 워크스페이스 — apps/api 와 libs/common 의 devDep 으로 등장하므로
# npm ci 가 workspace 그래프를 풀 때 필요. tools/* 디렉토리에 package.json 만
# 있으면 충분하다 (없으면 npm 이 registry 조회 fallback 후 404 로 깨진다).
COPY tools/dev-tools/package.json tools/dev-tools/
COPY tools/jest-helpers/package.json tools/jest-helpers/
RUN npm ci --no-audit
