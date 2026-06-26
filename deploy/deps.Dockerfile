# lockfile과 워크스페이스 package manifest만으로 `node_modules` 베이스 이미지를 만든다.
# `ensure-deps-image.sh`가 이 입력들의 해시를 태그로 쓰므로, 앱 이미지 빌드는 의존성이 바뀔 때만 npm install 비용을 다시 낸다.
FROM node:24-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY libs/temporal-sandbox/package.json libs/temporal-sandbox/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
COPY apps/user-app/package.json apps/user-app/
# npm은 lockfile만으로 워크스페이스 그래프를 완성하지 못한다.
# 배포 이미지에서 실행하지 않는 `tests/*` 워크스페이스도 manifest가 없으면 `npm ci`가 실패한다.
COPY tests/console-e2e/package.json tests/console-e2e/
# `tools/*`는 devDependency지만 워크스페이스 의존성이다.
# manifest를 복사하지 않으면 npm이 같은 이름의 패키지를 registry에서 찾으려 해 404로 실패한다.
COPY tools/dev-tools/package.json tools/dev-tools/
COPY tools/jest-helpers/package.json tools/jest-helpers/
# npm 레지스트리 연결이 일시로 끊기면(ECONNRESET) 빌드가 통째로 실패한다.
# 멱등한 설치라 백오프를 두고 최대 5번 시도한다. 실제 오류(lockfile 불일치 등)는 매 시도 같은 실패라 마지막에 그대로 드러난다.
RUN for attempt in 1 2 3 4 5; do \
        npm ci --no-audit && break; \
        [ "$attempt" = 5 ] && exit 1; \
        echo "npm ci failed (attempt ${attempt}/5), retrying in $((attempt * 10))s..." >&2; \
        sleep $((attempt * 10)); \
    done
