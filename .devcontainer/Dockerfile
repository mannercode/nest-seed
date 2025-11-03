FROM node:24-bookworm

RUN groupmod --gid 9999 node \
    && usermod --uid 9999 --gid 9999 node \
    && chown -R 9999:9999 /home/node

# ARG USERNAME=hunjuly
# ARG USER_UID=1000
# ARG USER_GID=$USER_UID


# # Create the user
# RUN groupadd --gid 9999 $USERNAME \
#     && useradd --uid 9999 --gid 9999 -m $USERNAME \
#     #
#     # [Optional] Add sudo support. Omit if you don't need to install software after connecting.
#     && apt-get update \
#     && apt-get install -y sudo \
#     && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
#     && chmod 0440 /etc/sudoers.d/$USERNAME

#     RUN groupmod --gid $USER_GID $USERNAME \
#     && usermod --uid $USER_UID --gid $USER_GID $USERNAME \
#     && chown -R $USER_UID:$USER_GID /home/$USERNAME

# ********************************************************
# * Anything else you want to do like clean up goes here *
# ********************************************************

# [Optional] Set the default user. Omit if you want to keep the default as root.
# USER $USERNAME

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
