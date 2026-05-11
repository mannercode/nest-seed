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

# Playwright 브라우저 + 동적 링크 시스템 라이브러리. Dockerfile RUN 은 root
# 로 도므로 `--with-deps` (apt 설치 단계 포함) 가 그대로 가능. 브라우저 경로는
# /opt/playwright 로 외부에 두어 npm reinstall 영향을 받지 않고 모든 워크스페이스
# (tests/console-e2e) 가 공유한다.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install --with-deps chromium
