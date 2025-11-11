FROM node:24-bookworm

ARG DEV_TOOLS="git curl jq tree vim net-tools screen"
ARG PLANTUML="openjdk-17-jre graphviz fonts-noto-cjk"
ARG SHELL_FORMATTER="shfmt"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $PLANTUML \
    $SHELL_FORMATTER \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar -O /opt/plantuml.jar
RUN npm i -g npm-check-updates
RUN npm i -g husky && npx husky

# sudo는 logstash 붙이면 제거해라
ARG USERNAME=node
RUN apt-get update && apt-get install -y sudo \
    && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

USER $USERNAME

# bash
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias l='ls --color=auto -lA'" >> ~/.bashrc
# locale
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
