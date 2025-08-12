FROM node:24-bookworm

# dev tools
# shfmt for foxundermoon.shell-format
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq tree vim net-tools \
    shfmt \
    && rm -rf /var/lib/apt/lists/*

# bash
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias l='ls --color=auto -lA'" >> ~/.bashrc

# locale
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# aws-cli
RUN ARCH=$(uname -m) \
    && curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-${ARCH}.zip" -o /tmp/awscliv2.zip \
    && unzip /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install \
    && rm -rf /tmp/aws /tmp/awscliv2.zip
