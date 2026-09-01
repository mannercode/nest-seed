FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e
ARG TARGETARCH

ENV LANG=C.UTF-8 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PNPM_CONFIG_UPDATE_NOTIFIER=false

RUN set -eu; \
    case "$TARGETARCH" in \
    amd64 | arm64) ;; \
    *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    node --version; \
    npm --version

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    ca-certificates curl git iproute2 jq shellcheck shfmt tmux tree unzip xz-utils; \
    rm -rf /var/lib/apt/lists/*; \
    curl --version; \
    git --version; \
    ip -Version; \
    jq --version; \
    shellcheck --version; \
    shfmt -version; \
    tmux -V; \
    tree --version; \
    unzip -v | sed -n '1p'; \
    xz --version

# OS 의존성은 이미지에 두고, lockfile과 일치하는 Chromium은 postCreateCommand에서 설치한다.
RUN set -eu; \
    npm install --global --no-audit --no-fund playwright; \
    playwright install-deps chromium; \
    playwright --version; \
    npm cache clean --force; \
    rm -rf /var/lib/apt/lists/*

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    default-jre-headless fonts-noto-cjk graphviz; \
    curl -fsSL --retry 3 --retry-all-errors \
    https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -o /tmp/plantuml.jar; \
    install -m 0644 /tmp/plantuml.jar /opt/plantuml.jar; \
    rm -f /tmp/plantuml.jar; \
    rm -rf /var/lib/apt/lists/*; \
    java -jar /opt/plantuml.jar -version

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
    rm -rf /tmp/lychee.tar.gz "/tmp/${archive}"; \
    lychee --version

RUN set -eu; \
    suffix="linux-${TARGETARCH}.tar.gz"; \
    download_url="$(curl -fsSL --retry 3 --retry-all-errors \
    https://api.github.com/repos/grafana/k6/releases/latest \
    | jq -er --arg suffix "$suffix" \
    '[.assets[].browser_download_url | select(endswith($suffix))] | if length == 1 then .[0] else error("expected exactly one matching k6 asset") end')"; \
    curl -fsSL --retry 3 --retry-all-errors "$download_url" -o /tmp/k6.tar.gz; \
    mkdir /tmp/k6; \
    tar -xzf /tmp/k6.tar.gz -C /tmp/k6 --strip-components=1; \
    install -m 0755 /tmp/k6/k6 /usr/local/bin/k6; \
    rm -rf /tmp/k6.tar.gz /tmp/k6; \
    k6 version

RUN set -eu; \
    curl -fsSL --retry 3 --retry-all-errors \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH}" -o /tmp/cloudflared; \
    install -m 0755 /tmp/cloudflared /usr/local/bin/cloudflared; \
    rm -f /tmp/cloudflared; \
    cloudflared --version

RUN set -eu; \
    npm install --global --no-audit --no-fund pnpm; \
    pnpm --version; \
    npm cache clean --force
