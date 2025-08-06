FROM node:24-bookworm

# dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq tree vim net-tools

# for foxundermoon.shell-format
RUN apt-get update && apt-get install -y --no-install-recommends shfmt

# bash
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias l='ls --color=auto -lA'" >> ~/.bashrc

# locale
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# docker
# https://docs.docker.com/engine/install/debian/
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli

# Remove all containers based on a specific Docker image
RUN echo 'rmcons() { docker rm -vf $(docker ps -aq --filter ancestor="$1"); }' >> ~/.bashrc

# remove tmp
RUN rm -rf /var/lib/apt/lists/*
