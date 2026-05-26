FROM node:24-slim
ENV LANG=C.UTF-8

ARG REQUIRED="git curl jq ca-certificates unzip"
ARG DEV_TOOLS="tree tmux iproute2"
ARG PLANTUML="openjdk-17-jre-headless graphviz fonts-noto-cjk"
ARG SHELL_FORMATTER="shfmt"
RUN set -Eeu; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    $REQUIRED \
    $DEV_TOOLS \
    $PLANTUML \
    $SHELL_FORMATTER; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSL "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar" -o /opt/plantuml.jar; \
    npm i -g npm-check-updates husky @commitlint/cli @anthropic-ai/claude-code playwright@1.60.0; \
    npm cache clean --force

# features/docker-outside-of-docker에 포함된 buildx는 ECR 푸시 중 TLS 버그로 죽는다.
# docker 공식 버전을 /usr/local/lib에 설치하면 기본 위치보다 먼저 검색돼 대체된다.
# 로컬은 amd64, GitHub Actions 러너는 arm64라 호스트 아키텍처를 감지해 같은 ABI의 바이너리를 받는다.
RUN ARCH=$(dpkg --print-architecture) \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL "https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-${ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-buildx \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# k6: tests/api-perf 부하 테스트 러너. 공식 GitHub release에서 v1.4.1을 고정해 받는다.
# (dl.k6.io apt 저장소도 있지만 그쪽은 stable 최신만 제공해 seed 사용자 간 버전이 어긋날 수 있다.)
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/grafana/k6/releases/download/v1.4.1/k6-v1.4.1-linux-${ARCH}.tar.gz" \
    -o /tmp/k6.tar.gz \
    && tar -xzf /tmp/k6.tar.gz -C /tmp \
    && mv "/tmp/k6-v1.4.1-linux-${ARCH}/k6" /usr/local/bin/k6 \
    && rm -rf /tmp/k6.tar.gz "/tmp/k6-v1.4.1-linux-${ARCH}"

# 브라우저 바이너리는 이미지 빌드 중 root 권한으로 설치되지만, 테스트는 node 사용자로 실행된다.
# 기본 경로(`/root/.cache/ms-playwright`) 대신 두 사용자가 모두 접근할 수 있는 `/opt/playwright`에 설치한다.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install --with-deps chromium
