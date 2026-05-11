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
    npm i -g npm-check-updates husky @commitlint/cli @anthropic-ai/claude-code playwright@1.59.1; \
    npm cache clean --force

# 이미지 빌드는 root 권한으로, 컨테이너 실행은 node 권한으로 한다.
# 브라우저를 기본 위치(`~/.cache/ms-playwright`)에 두면 `/root/` 아래로 들어가
# node 가 읽지 못한다. 그래서 `/opt` 에 둔다.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install --with-deps chromium
