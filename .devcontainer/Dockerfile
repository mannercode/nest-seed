FROM node:24-slim
ENV LANG=C.UTF-8

ARG REQUIRED="git curl jq ca-certificates"
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

# 브라우저 바이너리는 이미지 빌드 중 root 권한으로 설치되지만, 테스트는 node
# 사용자로 실행됩니다. 기본 경로(`/root/.cache/ms-playwright`) 대신 두 사용자가
# 모두 접근할 수 있는 `/opt/playwright`에 설치합니다.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install --with-deps chromium
