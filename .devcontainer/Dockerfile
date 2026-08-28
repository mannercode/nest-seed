FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e
ARG TARGETARCH

ENV LANG=C.UTF-8 \
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
        "playwright@${PLAYWRIGHT_VERSION}" \
        "@openai/codex"; \
    npm cache clean --force

# Chromium은 node 사용자도 읽을 수 있는 공용 경로에 설치한다.
RUN set -eu; \
    install -d -m 0755 "$PLAYWRIGHT_BROWSERS_PATH"; \
    playwright install --with-deps chromium; \
    chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"; \
    rm -rf /var/lib/apt/lists/*

# 개별 도구 버전 변경이 큰 Chromium 설치 계층의 캐시를 무효화하지 않도록 뒤에 둔다.
ARG PLANTUML_VERSION=1.2026.6
RUN set -eu; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml.jar" \
        -o /tmp/plantuml.jar; \
    printf '%s  %s\n' \
        '89948f14c93756c7a3fb7b69078ff37e8489fd79dd430c582b931e2f65358690' \
        /tmp/plantuml.jar | sha256sum -c -; \
    install -m 0644 \
        /tmp/plantuml.jar \
        /opt/plantuml.jar; \
    rm -f /tmp/plantuml.jar

ARG SHELLCHECK_VERSION=0.11.0
ARG LYCHEE_VERSION=0.24.2
RUN set -eu; \
    case "$TARGETARCH" in \
        amd64) \
            bin_arch=x86_64; \
            shellcheck_sha256=8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198; \
            lychee_sha256=73657a111819a30c47c08352896796f23d64e4eb2b3ed39b6d32149241566fc5 \
            ;; \
        arm64) \
            bin_arch=aarch64; \
            shellcheck_sha256=12b331c1d2db6b9eb13cfca64306b1b157a86eb69db83023e261eaa7e7c14588; \
            lychee_sha256=5d0b0e3aeab240f41920c633a6eaf97599be6eedda034b36e858ede7dba5e535 \
            ;; \
    esac; \
    \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.${bin_arch}.tar.xz" \
        -o /tmp/shellcheck.tar.xz; \
    printf '%s  %s\n' "$shellcheck_sha256" /tmp/shellcheck.tar.xz | sha256sum -c -; \
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
    printf '%s  %s\n' "$lychee_sha256" /tmp/lychee.tar.gz | sha256sum -c -; \
    tar -xzf /tmp/lychee.tar.gz -C /tmp; \
    install -m 0755 \
        "/tmp/lychee-${bin_arch}-unknown-linux-musl/lychee" \
        /usr/local/bin/lychee; \
    rm -rf \
        /tmp/lychee.tar.gz \
        "/tmp/lychee-${bin_arch}-unknown-linux-musl"

ARG K6_VERSION=2.2.0
RUN set -eu; \
    case "$TARGETARCH" in \
        amd64) k6_sha256=b5a8003c86f35f5cd5ceef1490312c48e587696c94d998cefc6d7b3b4cb1597d ;; \
        arm64) k6_sha256=4ecd64cadcc792402d16293836115480419c4447c032858f564852d98f1bf54c ;; \
    esac; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-${TARGETARCH}.tar.gz" \
        -o /tmp/k6.tar.gz; \
    printf '%s  %s\n' "$k6_sha256" /tmp/k6.tar.gz | sha256sum -c -; \
    tar -xzf /tmp/k6.tar.gz -C /tmp; \
    install -m 0755 \
        "/tmp/k6-v${K6_VERSION}-linux-${TARGETARCH}/k6" \
        /usr/local/bin/k6; \
    rm -rf \
        /tmp/k6.tar.gz \
        "/tmp/k6-v${K6_VERSION}-linux-${TARGETARCH}"

ARG CLOUDFLARED_VERSION=2026.8.2
RUN set -eu; \
    case "$TARGETARCH" in \
        amd64) cloudflared_sha256=fcfb02b575a52ca1af2e3267af4e1517bcdeb30ac48c834c69abaed3c0576ad2 ;; \
        arm64) cloudflared_sha256=7747d94570fb390cf47dcb4f9555c193c6355cda9793f0d878d9049e5d6a7790 ;; \
    esac; \
    curl -fsSL \
        --retry 3 \
        --retry-all-errors \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${TARGETARCH}" \
        -o /tmp/cloudflared; \
    printf '%s  %s\n' "$cloudflared_sha256" /tmp/cloudflared | sha256sum -c -; \
    install -m 0755 \
        /tmp/cloudflared \
        /usr/local/bin/cloudflared; \
    rm -f /tmp/cloudflared

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
