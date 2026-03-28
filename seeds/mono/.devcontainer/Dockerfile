FROM node:24-slim
ENV LANG=C.UTF-8

ARG DEV_TOOLS="git curl jq ca-certificates"
RUN set -Eeu; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    $DEV_TOOLS; \
    rm -rf /var/lib/apt/lists/*
