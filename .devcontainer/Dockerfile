FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03
ARG TARGETARCH

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

RUN set -eu; \
    case "$TARGETARCH" in \
        amd64 | arm64) ;; \
        *) \
            echo "Unsupported architecture: $TARGETARCH" >&2; \
            exit 1; \
            ;; \
    esac

RUN set -eu; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        fonts-noto-cjk \
        git \
        graphviz \
        iproute2 \
        jq \
        openjdk-17-jre-headless \
        shfmt \
        tmux \
        tree \
        unzip \
        xz-utils; \
    rm -rf /var/lib/apt/lists/*

ARG NPM_VERSION=12.0.2
ARG PLAYWRIGHT_VERSION=1.62.1

RUN set -eu; \
    npm install --global --no-audit --no-fund \
        "npm@${NPM_VERSION}"; \
    npm install --global --no-audit --no-fund \
        "playwright@${PLAYWRIGHT_VERSION}"; \
    npm cache clean --force

# Chromium은 node 사용자도 읽을 수 있는 공용 경로에 설치한다.
RUN set -eu; \
    install -d -m 0755 "$PLAYWRIGHT_BROWSERS_PATH"; \
    playwright install --with-deps chromium; \
    chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"; \
    rm -rf /var/lib/apt/lists/*

# 도구 다운로드는 Chromium 계층 뒤에 둔다.
ARG PLANTUML_VERSION=1.2026.6

RUN set -eu; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml.jar" \
        -o /tmp/plantuml.jar; \
    install -m 0644 \
        /tmp/plantuml.jar \
        /opt/plantuml.jar; \
    rm -f /tmp/plantuml.jar

ARG SHELLCHECK_VERSION=0.11.0
ARG LYCHEE_VERSION=0.24.2

RUN set -eu; \
    case "$TARGETARCH" in \
        amd64) bin_arch=x86_64 ;; \
        arm64) bin_arch=aarch64 ;; \
        *) \
            echo "Unsupported architecture: $TARGETARCH" >&2; \
            exit 1; \
            ;; \
    esac; \
    \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.${bin_arch}.tar.xz" \
        -o /tmp/shellcheck.tar.xz; \
    tar -xJf /tmp/shellcheck.tar.xz -C /tmp; \
    install -m 0755 \
        "/tmp/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" \
        /usr/local/bin/shellcheck; \
    rm -rf \
        /tmp/shellcheck.tar.xz \
        "/tmp/shellcheck-v${SHELLCHECK_VERSION}"; \
    \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-${bin_arch}-unknown-linux-musl.tar.gz" \
        -o /tmp/lychee.tar.gz; \
    tar -xzf /tmp/lychee.tar.gz -C /tmp; \
    install -m 0755 \
        "/tmp/lychee-${bin_arch}-unknown-linux-musl/lychee" \
        /usr/local/bin/lychee; \
    rm -rf \
        /tmp/lychee.tar.gz \
        "/tmp/lychee-${bin_arch}-unknown-linux-musl"

ARG K6_VERSION=2.2.0

RUN set -eu; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-${TARGETARCH}.tar.gz" \
        -o /tmp/k6.tar.gz; \
    tar -xzf /tmp/k6.tar.gz -C /tmp; \
    install -m 0755 \
        "/tmp/k6-v${K6_VERSION}-linux-${TARGETARCH}/k6" \
        /usr/local/bin/k6; \
    rm -rf \
        /tmp/k6.tar.gz \
        "/tmp/k6-v${K6_VERSION}-linux-${TARGETARCH}"

ARG CLOUDFLARED_VERSION=2026.8.2

RUN set -eu; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${TARGETARCH}" \
        -o /tmp/cloudflared; \
    install -m 0755 \
        /tmp/cloudflared \
        /usr/local/bin/cloudflared; \
    rm -f /tmp/cloudflared

# 설치 검증
RUN set -eu; \
    node --version; \
    npm --version; \
    shfmt -version; \
    java -jar /opt/plantuml.jar -version; \
    shellcheck --version; \
    lychee --version; \
    k6 version; \
    cloudflared --version; \
    playwright --version
