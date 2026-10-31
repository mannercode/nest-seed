# syntax=docker/dockerfile:1

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c

ENV LANG=C.UTF-8

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    ca-certificates curl git iproute2 jq openssh-client procps shellcheck shfmt tmux tree unzip; \
    rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    install -d -m 0755 /usr/share/keyrings; \
    curl -fsSL --retry 3 --retry-all-errors \
    "https://pkg.cloudflare.com/cloudflare-main.gpg" -o /usr/share/keyrings/cloudflare-main.gpg; \
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    > /etc/apt/sources.list.d/cloudflared.list; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cloudflared; \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.4.2

# OS 의존성은 이미지에 두고, Chromium은 pnpm 설치 후 같은 Playwright 버전으로 설치한다.
RUN --mount=type=bind,source=tests/web/package.json,target=/tmp/tests-web-package.json,ro \
    set -eu; \
    playwright_version="$(node -p "require('/tmp/tests-web-package.json').devDependencies['@playwright/test']")"; \
    npm_config_cache=/tmp/npm-cache npx --yes "playwright@${playwright_version}" install-deps chromium; \
    rm -rf /tmp/npm-cache /var/lib/apt/lists/*
