FROM node:24-bookworm

ENV LANG=C.UTF-8

ARG DEV_TOOLS="git curl jq tree vim net-tools screen iproute2 lsof"
ARG PLANTUML="openjdk-17-jre graphviz fonts-noto-cjk"
ARG SHELL_FORMATTER="shfmt"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $PLANTUML \
    $SHELL_FORMATTER \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -o /opt/plantuml.jar
RUN npm i -g npm-check-updates husky commitlint
