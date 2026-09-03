# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e

WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

ENTRYPOINT ["node", "node_modules/@playwright/test/cli.js", "test"]
