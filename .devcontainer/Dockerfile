FROM node:24-bookworm

RUN groupmod --gid 9999 node \
    && usermod --uid 9999 --gid 9999 node \
    && chown -R 9999:9999 /home/node

ARG DEV_TOOLS="git curl jq tree vim net-tools tmux"
ARG PLANTUML="openjdk-17-jre graphviz fonts-noto-cjk"
ARG MKHL_SHFMT="shfmt"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $PLANTUML \
    $MKHL_SHFMT \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -O /opt/plantuml.jar
