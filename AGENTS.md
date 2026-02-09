# AGENTS.md

## Project overview

- NestJS 11 monorepo with four services: `gateway` (REST controllers) → `applications` (user scenarios) → `cores` (domain logic) → `infrastructures` (external integrations).
- Strict one-way deps; no same-layer references. Keep controllers in gateway and service clients/controllers in the lower layers to avoid circular imports.
- Entry files are split per app (`development.ts`, `production.ts`, `main.ts` minimal). Set `TARGET_APP` to one of `gateway|applications|cores|infrastructures` for any run/build.

## Setup & run

- Host resources: >=4 cores, ideally 16GB RAM; if low, run tests in-band or lower worker counts (see README §1).
- Node 24.x; copy/adjust `.env` (host defaults to `host.docker.internal`) and `.env.infra` if your host IP differs.
- Install deps: `npm ci`.
- Start local infra (Mongo replica set, Redis, NATS, MinIO): `npm run infra:reset` (uses `infra/local/compose.yml` and `.env*`).
- Run all apps with Docker: `npm run apps:reset`; stop with `npm run apps:down`. For live debug: `TARGET_APP=gateway npm run debug`. Production build/start: `TARGET_APP=gateway npm run build && npm run start`.

## Testing

- Unit/integration: `npm test` (uses Testcontainers for Mongo/Redis/NATS/MinIO; Docker must be running). Scope with `TEST_ROOT=src/apps npm test`; repeat with `for i in {1..3}; do TEST_ROOT=src/apps npm test; done`. Coverage goes to `_output/coverage`.
- E2E: `npm run test:e2e` (requires `curl`/`jq`). Scripts reset infra/apps per suite and hit `http://localhost:${HTTP_PORT}`; apps are torn down at the end.

## Code style

- Prettier: 4-space indent, 100 char width, single quotes, no semicolons. Run `npm run format` or `npm run lint` (Prettier check + ESLint).
- ESLint (TypeScript) forbids floating promises and enforces `return-await`; prefix intentional unused vars with `_`.
- Jest naming: prefer `describe('when ...')` contexts and action-style `it('logs in')` titles; see `docs/ko/guides/implementation.guide.md#1-jest-테스트-명명-가이드`.
- Import rule to avoid cycles: do not absolute-import direct ancestors; use relative paths within a branch and absolute for non-ancestors (see implementation guide §3).

## Docs & references

- Quick start: `README.md`.
- Architecture rules: `docs/ko/guides/design.guide.md`.
- Implementation conventions (imports, entry files, test naming): `docs/ko/guides/implementation.guide.md`.
- Domain/design details: `docs/ko/designs/*.md`.
