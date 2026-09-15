# syntax=docker/dockerfile:1

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS build

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/console/package.json apps/console/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY tools/vitest-helpers/package.json tools/vitest-helpers/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/console...' --filter './libs/common' --store-dir /pnpm/store

COPY tsconfig.json ./
COPY libs/common/ libs/common/
RUN pnpm --filter './libs/common' --fail-if-no-match run build

COPY apps/console/ apps/console/
RUN pnpm --filter './apps/console' --fail-if-no-match run build

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS runtime

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3100

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/apps/console/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/console/.next/static ./apps/console/.next/static

USER node

EXPOSE 3100
CMD ["node", "apps/console/server.js"]
