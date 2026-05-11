# `node_modules` 만 미리 설치해 둔 베이스 이미지다. `ensure-deps-image.sh`
# 가 lockfile 과 이 Dockerfile 의 합본 해시를 태그로 잡아 로컬에서 빌드한다.
# `apps/*/Dockerfile` 이 이 이미지를 `FROM` 으로 가져오므로, 본 빌드 단계에
# `npm install` 이 들어가지 않는다. 워크스페이스가 lockfile 하나를 공유
# 하므로 베이스도 하나면 충분하다.
FROM node:24-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
# 루트 워크스페이스 설정이 `tests/*` 까지 잡으므로 함께 복사한다.
# `console-e2e` 자체는 배포 이미지에서 쓰지 않지만, `npm ci` 가 워크스페이스
# 그래프를 풀 때 디스크에 `package.json` 이 있어야 lockfile 의 항목과 어긋
# 나지 않는다 (`tools/*` 와 같은 stub 패턴).
COPY tests/console-e2e/package.json tests/console-e2e/
# `tools/*` 워크스페이스는 `apps/api` 와 `libs/common` 의 devDependency 로
# 등장한다. 그래서 `npm ci` 가 워크스페이스 그래프를 풀 때 필요하다. 디렉토리
# 마다 `package.json` 만 있으면 된다. 없으면 npm 이 registry 에서 찾으려다
# 404 로 깨진다.
COPY tools/dev-tools/package.json tools/dev-tools/
COPY tools/jest-helpers/package.json tools/jest-helpers/
RUN npm ci --no-audit
