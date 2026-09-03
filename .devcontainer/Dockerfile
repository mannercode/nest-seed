# syntax=docker/dockerfile:1

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e

ENV LANG=C.UTF-8

RUN set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
    ca-certificates curl git iproute2 jq openssh-client shellcheck shfmt tmux tree unzip; \
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

RUN npm install -g pnpm@11.25.0
