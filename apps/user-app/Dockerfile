# syntax=docker/dockerfile:1

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS build

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/user-app/package.json apps/user-app/
COPY libs/common/package.json libs/common/
COPY libs/testing/package.json libs/testing/
COPY tools/vitest-helpers/package.json tools/vitest-helpers/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/user-app...' --filter './libs/common' --store-dir /pnpm/store

COPY tsconfig.json ./
COPY libs/common/ libs/common/
RUN pnpm --filter './libs/common' --fail-if-no-match run build

COPY apps/user-app/ apps/user-app/
RUN pnpm --filter './apps/user-app' --fail-if-no-match run build

FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS runtime

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3200

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/apps/user-app/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/user-app/.next/static ./apps/user-app/.next/static

USER node

EXPOSE 3200
CMD ["node", "apps/user-app/server.js"]
