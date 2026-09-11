# syntax=docker/dockerfile:1

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae

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

RUN npm install -g pnpm@12.3.4
