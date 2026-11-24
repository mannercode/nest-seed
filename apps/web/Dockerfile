# syntax=docker/dockerfile:1
FROM node:26.13-slim AS base

FROM base AS build

ENV pnpm_config_store_dir=/pnpm/store

WORKDIR /workspace
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')"
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY tools/ tools/

RUN --mount=type=cache,id=nest-seed-pnpm,target=$pnpm_config_store_dir,sharing=locked \
    HUSKY=0 pnpm install --frozen-lockfile --filter './apps/web...'

COPY apps/web/ apps/web/
RUN pnpm --filter './apps/web' --fail-if-no-match run build

FROM base AS runtime

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3200

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3200
CMD ["node", "apps/web/server.js"]
