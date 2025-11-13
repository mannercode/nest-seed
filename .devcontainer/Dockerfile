FROM node:24-bookworm

ENV LANG=C.UTF-8

ARG DEV_TOOLS="git curl jq tree vim net-tools screen"
ARG PLANTUML="openjdk-17-jre graphviz fonts-noto-cjk"
ARG SHELL_FORMATTER="shfmt"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $PLANTUML \
    $SHELL_FORMATTER \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -O /opt/plantuml.jar
RUN npm i -g npm-check-updates husky

# TODO logstash 붙이면 제거해라
RUN apt-get update && apt-get install -y sudo \
    && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node
