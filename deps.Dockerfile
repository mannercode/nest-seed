# lockfile과 워크스페이스 package manifest만으로 `node_modules` 베이스 이미지를
# 만든다. `ensure-deps-image.sh`가 이 입력들의 해시를 태그로 쓰므로, 앱 이미지
# 빌드는 의존성이 바뀔 때만 npm install 비용을 다시 낸다.
FROM node:24-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY libs/temporal-sandbox/package.json libs/temporal-sandbox/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
# npm은 lockfile만으로 워크스페이스 그래프를 완성하지 못한다. 배포 이미지에서
# 실행하지 않는 `tests/*` 워크스페이스도 manifest가 없으면 `npm ci`가 실패한다.
COPY tests/console-e2e/package.json tests/console-e2e/
# `tools/*`는 devDependency지만 워크스페이스 의존성이다. manifest를 복사하지
# 않으면 npm이 같은 이름의 패키지를 registry에서 찾으려 해 404로 실패한다.
COPY tools/dev-tools/package.json tools/dev-tools/
COPY tools/jest-helpers/package.json tools/jest-helpers/
RUN npm ci --no-audit
