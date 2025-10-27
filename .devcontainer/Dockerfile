FROM node:24-bookworm

# bash
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias l='ls --color=auto -lA'" >> ~/.bashrc

# locale
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

ARG DEV_TOOLS="git curl jq tree vim net-tools shfmt"
ARG PLANTUML="openjdk-17-jre graphviz fonts-noto-cjk"
ARG MKHL_SHFMT="shfmt"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $PLANTUML \
    $MKHL_SHFMT \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -O /opt/plantuml.jar
RUN npm i -g npm-check-updates
