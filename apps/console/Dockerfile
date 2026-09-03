# syntax=docker/dockerfile:1

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS build

RUN npm install -g pnpm

WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/console/package.json apps/console/
COPY tools/dev-tools/package.json tools/dev-tools/free-port.js tools/dev-tools/tunnel.sh tools/dev-tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=/pnpm/store,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/console...' --store-dir /pnpm/store

COPY apps/console/ apps/console/
RUN API_BASE_URL=http://api:3000 pnpm --filter './apps/console' --fail-if-no-match run build

FROM node:26.8.1-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3100

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/apps/console/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/console/.next/static ./apps/console/.next/static

USER node

EXPOSE 3100
CMD ["node", "apps/console/server.js"]
