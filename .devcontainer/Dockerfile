FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS base

FROM base AS downloaded-tools

ARG PLANTUML_VERSION=1.2026.6
ARG SHELLCHECK_VERSION=0.11.0
ARG LYCHEE_VERSION=0.24.2
ARG K6_VERSION=2.2.0
ARG CLOUDFLARED_VERSION=2026.8.2

RUN set -eu; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl; \
    rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) release_arch=x86_64 ;; \
        arm64) release_arch=aarch64 ;; \
        *) \
            echo "Unsupported architecture: $arch" >&2; \
            exit 1; \
            ;; \
    esac; \
    tmp_dir="$(mktemp -d)"; \
    download() { \
        curl -fsSL \
            --retry 3 \
            --retry-all-errors \
            "$1" \
            -o "$2"; \
    }; \
    unpack() { \
        mkdir "$2"; \
        tar -xzf "$1" \
            -C "$2" \
            --strip-components=1; \
    }; \
    install -d \
        /out/opt \
        /out/usr/local/bin; \
    \
    download \
        "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.${release_arch}.tar.gz" \
        "$tmp_dir/shellcheck.tar.gz"; \
    unpack \
        "$tmp_dir/shellcheck.tar.gz" \
        "$tmp_dir/shellcheck"; \
    install -m 0755 \
        "$tmp_dir/shellcheck/shellcheck" \
        /out/usr/local/bin/shellcheck; \
    \
    download \
        "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-${release_arch}-unknown-linux-musl.tar.gz" \
        "$tmp_dir/lychee.tar.gz"; \
    unpack \
        "$tmp_dir/lychee.tar.gz" \
        "$tmp_dir/lychee"; \
    install -m 0755 \
        "$tmp_dir/lychee/lychee" \
        /out/usr/local/bin/lychee; \
    \
    download \
        "https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml.jar" \
        /out/opt/plantuml.jar; \
    printf '%s\n' \
        '#!/bin/sh' \
        'exec java -jar /opt/plantuml.jar "$@"' \
        > /out/usr/local/bin/plantuml; \
    chmod 0755 /out/usr/local/bin/plantuml; \
    \
    download \
        "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-${arch}.tar.gz" \
        "$tmp_dir/k6.tar.gz"; \
    unpack \
        "$tmp_dir/k6.tar.gz" \
        "$tmp_dir/k6"; \
    install -m 0755 \
        "$tmp_dir/k6/k6" \
        /out/usr/local/bin/k6; \
    \
    download \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${arch}" \
        /out/usr/local/bin/cloudflared; \
    chmod 0755 /out/usr/local/bin/cloudflared; \
    \
    rm -rf "$tmp_dir"


FROM base AS development

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

ARG NPM_VERSION=12.0.2
ARG PLAYWRIGHT_VERSION=1.62.1
ARG COMMITLINT_VERSION=21.2.2

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
        unzip; \
    rm -rf /var/lib/apt/lists/*


# Playwright 패키지와 브라우저 버전을 맞춘다.
RUN npm install --global --no-audit --no-fund \
        "npm@${NPM_VERSION}" \
    && npm install --global --no-audit --no-fund \
        "playwright@${PLAYWRIGHT_VERSION}" \
    && npm cache clean --force


# 시스템 의존성과 Chromium 다운로드를 분리한다.
# 브라우저 다운로드가 실패해도 APT 설치 계층은 다시 사용할 수 있다.
RUN playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

RUN install -d -m 0777 \
        "$PLAYWRIGHT_BROWSERS_PATH" \
        "$PLAYWRIGHT_BROWSERS_PATH/.links" \
    && playwright install chromium \
    && chmod -R a+rwX "$PLAYWRIGHT_BROWSERS_PATH"


# 변경 빈도가 높은 도구는 비싼 Chromium 계층 뒤에 둔다.
RUN npm install --global --no-audit --no-fund \
        "@commitlint/cli@${COMMITLINT_VERSION}" \
    && npm cache clean --force


# 독립 실행 파일 변경이 Chromium 계층을 무효화하지 않도록 마지막에 복사한다.
COPY --from=downloaded-tools /out/ /


# 경로·권한·아키텍처가 잘못되면 이미지 빌드 중 바로 실패한다.
RUN node --version \
    && npm --version \
    && shfmt --version \
    && plantuml -version \
    && shellcheck --version \
    && lychee --version \
    && k6 version \
    && cloudflared --version \
    && playwright --version \
    && commitlint --version
