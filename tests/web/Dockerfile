# syntax=docker/dockerfile:1

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS dependencies

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tests/web/package.json tests/web/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --filter './tests/web' --ignore-scripts --store-dir /pnpm/store \
    && pnpm --filter './tests/web' --fail-if-no-match deploy --legacy --ignore-scripts --store-dir /pnpm/store /work

FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27

WORKDIR /work
COPY --from=dependencies /work/package.json ./
COPY --from=dependencies /work/node_modules ./node_modules

ENTRYPOINT ["node", "node_modules/@playwright/test/cli.js", "test"]
