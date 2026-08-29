# 이 Dockerfile, pnpm workspace/lockfile과 모든 workspace manifest로 `node_modules` 베이스 이미지를 만든다.
# `ensure-deps-image.sh`가 이 입력들의 해시를 태그로 쓰므로, 앱 이미지 빌드는 의존성 입력이 바뀔 때만 pnpm install 비용을 다시 낸다.
FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e

RUN npm install --global --no-audit --no-fund pnpm@11.24.0

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
COPY apps/user-app/package.json apps/user-app/
# pnpm은 lockfile만으로 workspace 그래프를 완성하지 못한다.
# 배포 이미지에서 실행하지 않는 `tests/*` workspace도 manifest가 없으면 frozen install이 실패한다.
COPY tests/web/package.json tests/web/
COPY tests/api-race/package.json tests/api-race/
# `tools/*`는 devDependency지만 워크스페이스 의존성이다.
# manifest를 복사하지 않으면 local workspace dependency를 연결할 수 없다.
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/
COPY tools/vitest-helpers/package.json tools/vitest-helpers/
# npm registry 연결이 일시로 끊기면(ECONNRESET) 빌드가 통째로 실패한다.
# 멱등한 설치라 백오프를 두고 최대 5번 시도한다. 실제 오류(lockfile 불일치 등)는 매 시도 같은 실패라 마지막에 그대로 드러난다.
RUN for attempt in 1 2 3 4 5; do \
        HUSKY=0 pnpm install --frozen-lockfile && break; \
        [ "$attempt" = 5 ] && exit 1; \
        echo "pnpm install failed (attempt ${attempt}/5), retrying in $((attempt * 10))s..." >&2; \
        sleep $((attempt * 10)); \
    done
