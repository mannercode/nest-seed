# syntax=docker/dockerfile:1

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS build

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/user-app/package.json apps/user-app/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/user-app...' --store-dir /pnpm/store

COPY apps/user-app/ apps/user-app/
RUN pnpm --filter './apps/user-app' --fail-if-no-match run build

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3200

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/apps/user-app/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/user-app/.next/static ./apps/user-app/.next/static

USER node

EXPOSE 3200
CMD ["node", "apps/user-app/server.js"]
