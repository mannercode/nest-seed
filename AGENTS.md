# Repository Guidelines

## Project Structure & Module Organization
`src` hosts Nest apps by layer: `gateway` (HTTP ingress), `applications` (orchestration), `cores` (domain), `infrastructures` (external connectors), and `shared` (config/modules/pipes). Integration specs sit in `src/apps/__tests__`, reusable helpers in `libs/common` and `libs/testlib`, and infra assets in `compose.yml`, `Dockerfile`, `scripts/`, `infra/`, with end-to-end harnesses under `test/e2e`.

## Build, Test, and Development Commands
- `TARGET_APP=gateway npm run build` – bundles the selected service via Nest CLI + webpack.
- `TARGET_APP=gateway npm start` – launches `_output/dist/<app>/index.js`.
- `TARGET_APP=gateway npm run debug` – watch-mode start for rapid feedback.
- `npm test` – drives `scripts/run-test.sh`, rehydrating Mongo/Redis/NATS before Jest.
- `npm run test:e2e` – containerized build + end-to-end checks through `scripts/run-apps.sh`.
- `npm run lint` – Prettier format pass followed by ESLint on `src/**/*.ts`.

## Coding Style & Naming Conventions
TypeScript plus Prettier yields 2-space indentation, single quotes, and semicolons. Follow Nest idioms: modules end with `*.module.ts`, providers/controllers stay PascalCase, DTOs/validators sit next to their feature folders, configs live in `src/apps/shared/config`, and filenames remain kebab-case (`ticket-holding.service.ts`).

## Testing Guidelines
Use Jest for unit and integration coverage; keep integration specs in each service’s `__tests__` folder and e2e flows in `test/e2e`. Name files `*.spec.ts`, describe behaviors over methods, and pair new contracts with an integration spec at the relevant boundary. For flakiness, rerun with `maxWorkers=1` or raise `testTimeout` in `jest.config.ts` per the README guidance.

## Commit & Pull Request Guidelines
Match the conventional prefixes already in history (`fix:`, `refactor:`, etc.), keep imperative subjects under 80 chars, and outline scope in the body (infra scripts, env files, affected services). PRs should link issues (`Closes #123`), summarize service-level impact, call out infra/docker adjustments, and paste `npm test` / `npm run test:e2e` output. Include screenshots or sample payloads when gateway APIs or DTO contracts shift.

## Security & Configuration Tips
Secrets stay in `.env.*` files and are never committed; consult `SECURITY.md` before disclosing vulnerabilities. When bumping Mongo/Redis/NATS versions, update `.env.infra` and Compose together, inject credentials through `src/apps/shared/config`, and rerun `scripts/reset-infra.sh` to refresh containers.\n*** End Patch"} >>
