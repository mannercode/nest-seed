FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e
ARG TARGETARCH

ENV LANG=C.UTF-8 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PNPM_CONFIG_UPDATE_NOTIFIER=false

RUN set -eu; \
    case "$TARGETARCH" in \
    amd64 | arm64) ;; \
    *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    ca-certificates curl git iproute2 jq shellcheck shfmt tmux tree unzip; \
    rm -rf /var/lib/apt/lists/*

COPY tests/web/package.json /tmp/tests-web-package.json

RUN set -eu; \
    playwright_version="$(node -p "require('/tmp/tests-web-package.json').devDependencies['@playwright/test']")"; \
    npm_config_cache=/tmp/npm-cache npx --yes "playwright@${playwright_version}" install-deps chromium; \
    rm -rf /tmp/npm-cache /tmp/tests-web-package.json; \
    rm -rf /var/lib/apt/lists/*

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    default-jre-headless fonts-noto-cjk graphviz; \
    curl -fsSL --retry 3 --retry-all-errors \
    https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -o /tmp/plantuml.jar; \
    install -m 0644 /tmp/plantuml.jar /opt/plantuml.jar; \
    rm -f /tmp/plantuml.jar; \
    rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    case "$TARGETARCH" in \
    amd64) bin_arch=x86_64 ;; \
    arm64) bin_arch=aarch64 ;; \
    esac; \
    archive="lychee-${bin_arch}-unknown-linux-musl"; \
    curl -fsSL --retry 3 --retry-all-errors \
    "https://github.com/lycheeverse/lychee/releases/latest/download/${archive}.tar.gz" -o /tmp/lychee.tar.gz; \
    tar -xzf /tmp/lychee.tar.gz -C /tmp; \
    install -m 0755 "/tmp/${archive}/lychee" /usr/local/bin/lychee; \
    rm -rf /tmp/lychee.tar.gz "/tmp/${archive}"

RUN set -eu; \
    install -d -m 0755 /etc/apt/keyrings /usr/share/keyrings; \
    curl -fsSL --retry 3 --retry-all-errors \
    "https://dl.k6.io/key.gpg" -o /etc/apt/keyrings/k6.asc; \
    curl -fsSL --retry 3 --retry-all-errors \
    "https://pkg.cloudflare.com/cloudflare-main.gpg" -o /usr/share/keyrings/cloudflare-main.gpg; \
    echo "deb [signed-by=/etc/apt/keyrings/k6.asc] https://dl.k6.io/deb stable main" \
    > /etc/apt/sources.list.d/k6.list; \
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    > /etc/apt/sources.list.d/cloudflared.list; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cloudflared k6; \
    rm -rf /var/lib/apt/lists/*

COPY package.json /tmp/workspace-package.json

RUN set -eu; \
    package_manager="$(node -p "require('/tmp/workspace-package.json').packageManager")"; \
    npm_config_cache=/tmp/npm-cache npm install --global --no-audit --no-fund "$package_manager"; \
    rm -rf /tmp/npm-cache /tmp/workspace-package.json
