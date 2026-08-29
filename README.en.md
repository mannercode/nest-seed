# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)

_English translation of [README.md](README.md). The Korean original is authoritative._

This seed is built with learning in mind, but it is also a base for real production work — the author runs commercial projects on it. The NestJS backend (`apps/api`) is the main body. It is designed as a monolith, but module boundaries are drawn up front so that a feature can be split off into an independent service when the need arises.

The boundaries take two concrete forms. The five SoLA layers forbid modules in the same layer from calling each other directly, and controllers live in a separate Gateway layer rather than inside each module as NestJS convention would have it. As a result, a module is coupled neither to its neighbor modules nor to HTTP — the layer rules are explained in the [apps document](docs/apps.md#sola-5계층).

So that splitting a service off never has to start with untangling the database, no DB relationship crosses a module boundary — no foreign keys, no joins; services manage relationships by ID. Since the core value of a relational database would go unused, the seed uses MongoDB, and consistency across domains is the services' responsibility rather than a DB constraint's.

The admin console and the user app are minimal demos showing how frontends sit in the monorepo.

The example domain is movie ticketing. Everyone knows it, seats are a contended resource, and although the code is a monolith the verification stack runs 4 API containers to reproduce distributed problems such as double selling, partial failure, and progress reporting. Use cases such as showtime registration, booking, and purchase sit on top of models like movies, theaters, showtimes, and tickets, and every pattern in the code is named in these domain terms.

The three problems are solved like this:

- **Double selling** — blocked not with a lock but with an atomic conditional transition (an update whose filter carries the state) (`core/tickets`)
- **Partial failure** — Restate retries durable steps, while one MongoDB transaction commits showtimes, tickets, and the idempotency operation record together (`application/showtime-creation`)
- **Progress reporting** — NATS pub/sub carries events all the way to SSE clients attached to other containers (`application/showtime-creation`)

Whether these solutions actually work is verified by mock-free tests on real infrastructure (100% coverage in implementation workspaces that collect it), a distributed race harness, and repeated CI runs. The full list of patterns is in the [Domain tour](#domain-tour); the reasoning behind tool choices is in [Design decisions](docs/reference/decisions.md).

## Getting started

Development happens in a Dev Container. You need Docker and VS Code with the Dev Containers extension installed. Because several pieces of infrastructure — a MongoDB Replica Set, a Redis Cluster, and more — have to come up together, running directly on the host is not supported. The environment-variable flow and the boot process are laid out in [Environment variables](docs/reference/environment.md).

The minimum spec is 4 CPU cores, 16GB RAM, and 32GB of disk. To run the full test suite reliably, 32GB+ RAM is recommended.

First boot goes like this:

1. **If you forked this as a new project**, do not mechanically replace names across the entire repository. Change only the package, env, and Compose identifiers listed in [Environment variables §4](docs/reference/environment.md#4-포크할-때-확인할-값). Review author-owned external URLs, contact details, and the original-repository ID sentinel deliberately rather than replacing them in bulk. Then follow [GitHub operations setup](docs/github-setup.md#6-fork-완료-확인) for rulesets, Actions secrets, security features, and scheduled-CI opt-in that forks do not inherit.
2. Run `Reopen in Container` in VS Code. Once the container opens, `postStartCommand` runs `bash infra/reset.sh` to prepare the development infrastructure. The first boot can take a while — Dev Container image build, `pnpm install --frozen-lockfile`, and infrastructure image downloads. If the infrastructure ever gets into a bad state, reset it anytime with `bash infra/reset.sh`.
3. Run `pnpm run test` to confirm the basic tests pass. To check the full regression right after forking, run `pnpm run atoz`.
4. Start watch mode with `pnpm run dev`, then check the API is alive with `curl http://localhost:3000/health`.
5. Log in to the console (3100). Right after boot there are no admins, so create the first one with Basic auth as the root account (the username is fixed to `root`; the password is `ROOT_PASSWORD` from `.env.api`, already injected into the devcontainer terminal).

    ```bash
    curl -u "root:${ROOT_PASSWORD}" -H 'Content-Type: application/json' \
        -d '{"email":"admin@example.com","password":"admin1234!","name":"Admin"}' \
        http://localhost:3000/admins
    ```

    The full admin API — login, token refresh, deletion — is shown by [admins.spec](apps/api/api-docs/admins.spec).

6. Register movies and theaters in the console. Showtime registration (202+SSE), booking, and purchase are shown not by the UI demo but by the executable API docs — create showtimes with `bash apps/api/api-docs/run.sh showtime-creation.spec`, then sign up in the user app (3200) and see the now-showing movies on its home screen.

> `.env.api` and `.env.infra` are committed **development defaults** (including `ROOT_PASSWORD=DevPass1!`). Change them to your own values when you fork.

## Development commands

Development is test-driven — a test brings up the environment it needs (infrastructure plus the module under test) in code, so the loop for working on one module stays the same even after services are split apart (why this matches the design: [apps document](docs/apps.md#테스트)). The working loop is mostly running a single spec ([Tests](#tests) below); starting the apps directly with `pnpm run dev` gets heavier as services multiply, so use it only when you need the real app.

| Command                | Purpose                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm run test`        | Workspace unit, integration, and contract tests; 100% gate for implementation workspaces that collect coverage     |
| `pnpm run lint`        | All static checks — type check, ESLint, Prettier, shellcheck, doc links                                            |
| `pnpm run dev`         | To run the real apps — api (3000), console (3100), user-app (3200) + libs watch                                    |
| `pnpm run dev:api`     | API only                                                                                                           |
| `pnpm run dev:restate` | Register the development Restate endpoint when `dev:api` runs separately; included in full `dev`                   |
| `pnpm run atoz`        | Full verification after forking / before deploying — lint, tests, API docs, e2e, and deployment from a clean slate |

> `pnpm run clean`, which `pnpm run atoz` calls internally, removes only the generated paths allowlisted by `tools/clean-workspace.mjs`, such as `node_modules`, `_output`, coverage, and build output. It does not delete personal env/config files merely because they are gitignored. For the remaining scripts, see [package.json](package.json).

## Tests

```bash
pnpm --filter './apps/api' test users.spec --coverage.enabled=false # run a single spec (gate off)
pnpm run e2e                                                     # console and user-app browser e2e (Playwright)
pnpm run e2e:report                                              # open the latest browser e2e HTML report
pnpm run race <scenario>                                         # distributed races — brings up a multi-replica deployment stack
pnpm run benchmark:api                                           # performance measurement — stack boot, seeding, measurement, teardown in one go
```

Vitest prints the `describe`/`it` hierarchy in the terminal with its tree reporter. A full API run stores per-invocation coverage under `apps/api/_output/vitest-runs/r<run ID>/coverage/`; common-library coverage goes to `libs/common/_output/coverage/`. Test logs stay in the terminal instead of being duplicated to files. The test system and writing rules are described in the [apps document](docs/apps.md#테스트); how to run and interpret the distributed race and performance tools, in the [tests document](docs/tests.md).

## Deployment

```bash
bash deploy/verify.sh   # brings up a fresh API 4-replica + NGINX stack, verifies it, and tears it down
```

`verify.sh` walks the multi-replica verification flow in one run, from preparing the deps image (the dependency-install layer) to verifying the executable API docs. `deploy/` is a **verification/reference stack**, not a production deployment with TLS, secret management, backups, and frontend deployment. The configuration, replica policy, repeated-CI image prebuild, and `x-replica-id` response header are in the [deploy document](docs/deploy.md).

## API reference

There is deliberately no Swagger/OpenAPI (the reasoning is in [Design decisions](docs/reference/decisions.md)). The request/response endpoint catalog is the **executable `apps/api/api-docs/*.spec`** files themselves. With the dev server up, run them with `bash apps/api/api-docs/run.sh`; otherwise `verify.sh` from [Deployment](#deployment) above runs them as part of its flow. Either way a browsable listing is generated under `apps/api/api-docs/_output/` — it is gitignored, so it does not exist right after cloning; run once to create it. Long-lived SSE is verified by an integration test instead. Spec conventions, redaction, the SSE exclusion, and output layout are in the [apps document](docs/apps.md#실행-가능한-api-문서).

## Project structure

```
nest-seed/
├── libs/                    ← shared libraries (workspace packages)
│   ├── common/              ← @mannercode/common — MongoDB driver, Redis, JWT, S3, Logger, NATS
│   └── testing/             ← @mannercode/testing — HttpTestClient, fixture helpers
│
├── apps/
│   ├── api/                 ← NestJS API — 5-layer services + executable api-docs/
│   ├── console/             ← Next.js admin console — minimal demo
│   └── user-app/            ← Next.js user app — minimal demo
│
├── tests/
│   ├── api-race/            ← distributed race scenarios against a deployed API stack
│   ├── api-benchmark/       ← performance comparison tools against a deployed API stack
│   └── web/                 ← Playwright browser e2e + shared BFF contract tests
│
├── infra/                   ← development infrastructure Compose (MongoDB, Redis, VersityGW, NATS, Restate)
├── deploy/                  ← Docker Compose, NGINX (app deployment entry point)
├── tools/                   ← dev/test helper tools (free-port, Vitest helpers, quick tunnel)
├── docs/                    ← folder documents plus cross-cutting references (reference/)
├── .github/                 ← CI workflows (atoz, test-stability)
│
└── .devcontainer/           ← Dev Container definition
```

What each folder is and why it is split this way is covered by the folder documents in the [Documentation](#documentation) section. The five layers (SoLA) under `apps/api/src/services` and the distributed-collaboration structure are explained in the [apps document](docs/apps.md).

## Tech stack

If a tool is new to you, start from the code path or document in the "Where it's used" column.

| Tool                                    | Where it's used                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB (Replica Set) + official driver | Primary database. Transactions, soft delete — `libs/common/mongodb`                                                                                             |
| Redis (Cluster) + ioredis               | Cache and distributed locks — `libs/common/redis`, `libs/common/cache`                                                                                          |
| NATS                                    | Pub/sub across containers — `libs/common/nats`                                                                                                                  |
| Restate                                 | Durable saga workflows — `application/showtime-creation/worker`                                                                                                 |
| VersityGW (S3 API)                      | Presigned file upload/download — `libs/common/s3`, `infrastructure/assets`                                                                                      |
| NestJS                                  | API server. Guards and pipes implemented directly, without Passport — `gateway/`                                                                                |
| Next.js                                 | console and user-app minimal demos                                                                                                                              |
| @nestjs/jwt + bcrypt                    | Per-role token signing/verification — `gateway/guards`; password hashing — `core/{users,admins}/internal`                                                       |
| Zod + Standard Schema                   | Environment and HTTP request validation — `config/`, `gateway/`                                                                                                 |
| pnpm workspace                          | Monorepo layout. Shares libs as internal packages                                                                                                               |
| Vitest + Testcontainers                 | Unit and integration tests. `libs/common` brings up its own infrastructure — [apps document](docs/apps.md#테스트)                                               |
| Playwright                              | Console/user-app browser e2e and shared BFF contracts — `tests/web`                                                                                             |
| k6                                      | Performance comparison harness — `tests/api-benchmark`                                                                                                          |
| Docker Compose + NGINX                  | Development infrastructure (`infra/`) and multi-container deployment (`deploy/`)                                                                                |
| GitHub Actions                          | atoz regression and repeated stability verification — `.github/workflows`                                                                                       |
| cloudflared (`pnpm exec tunnel`)        | Always refuses direct API; app BFFs proxy most API routes except selected auth endpoints, so exposure requires both opt-in flags in a disposable environment    |
| ESLint·Prettier·husky·commitlint        | Layer-dependency enforcement (eslint-plugin-boundaries) — [apps document](docs/apps.md#sola-5계층); commit hooks — [Conventions](docs/reference/conventions.md) |

## Domain tour

Each service is built to show one distinct pattern. For a first pass, this order works well:

1. `core/theaters` — the simplest domain. The basic skeleton: model → repository → service → controller → DTO
2. `application/booking` — a use case composing multiple Core services
3. `application/showtime-creation` — the whole saga: 202 response → Restate workflow → NATS → SSE
4. At each step, read the integration test of the same name (`apps/api/src/__tests__`) side by side

| Service                                   | What it shows                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `core/theaters`                           | The simplest CRUD. The reference to clone when adding a new domain                                       |
| `core/movies`                             | File upload integration, draft→publish state, deletion refused while showtimes reference the movie       |
| `core/users` · `admins`                   | Soft delete × unique indexes, login and token rotation, session revocation on withdrawal/password change |
| `core/showtimes` · `tickets`              | The resources the saga produces. tickets change state via atomic conditional transitions                 |
| `core/ticket-holding`                     | Redis Lua-script seat holds — keys grouped into one hash slot so Lua can handle multiple keys atomically |
| `core/purchase-records` · `watch-records` | User-record domains. watch-records feeds the recommendations                                             |
| `application/booking`                     | Booking-flow queries and seat holds, request validation                                                  |
| `application/purchase`                    | Durable state machine, lease reconciliation and outbox; at-least-once JetStream notification handling    |
| `application/showtime-creation`           | Restate workflow keyed by `sagaId`, 202+SSE, Mongo transaction, theater-guard CAS, and idempotent retry  |
| `application/recommendation`              | Watch-history-based recommendations. Domain logic split into a pure module                               |
| `view/user-app/home`                      | Screen-specific response composition — the View layer                                                    |
| `infrastructure/assets`                   | Presigned uploads with checksum verification, a cron that cleans up expired uploads (distributed lock)   |
| `infrastructure/payments`                 | The seat where an external payment integration goes                                                      |

## Authorization

JWT-based, with three roles. **root** only creates and deletes admins, using Basic auth with credentials from `.env.api`; **admin** (the role the console uses) handles content management and operations targeting arbitrary users; **user** (the user app) touches only its own resources. Admin and user tokens are signed with different secrets, so they cannot be used interchangeably. A user's own resources are handled only through `/me`-style paths with no identifier in the URL (the identifier is fixed to the token subject), and every path that accepts an arbitrary ID is admin-only. As a result, the user role has no path where a logged-in user could swap in someone else's ID (IDOR) — the design rule is in the [apps document](docs/apps.md#본인-자원은-me로-다룬다).

## Documentation

The detail behind this README lives in six folder documents, four references, and one operations document. **Korean is the source language for the detailed documents and code comments.** This file is a translation of [README.md](README.md); where the two disagree, the Korean version wins. Keeping the detailed documents in one source language avoids silent drift between two copies.

**Folder documents** — what each folder is and why it is split this way. Start here:

- [apps/](docs/apps.md) — the main API and the two minimal demo apps
    - [SoLA 5 layers](docs/apps.md#sola-5계층) — the layer rules that eliminate circular references
    - [Distributed collaboration](docs/apps.md#분산-협력--msa-준비형-모놀리스) — where distributed locks, NATS, and Restate are used
    - [Code conventions](docs/apps.md#코드-컨벤션) — naming, errors, imports, REST, denormalization
    - [Tests](docs/apps.md#테스트) — real-infrastructure testing rules and fixtures
    - [Executable API docs](docs/apps.md#실행-가능한-api-문서) — spec conventions and outputs
- [libs/](docs/libs.md) — how the two shared packages are split
- [tests/](docs/tests.md) — the tests that verify a deployed stack from the outside, and how to run them
- [infra/](docs/infra.md) — the development-infrastructure compose bundle and its consumers
- [deploy/](docs/deploy.md) — Docker Compose multi-API-container + NGINX, the `x-replica-id` response header
- [.devcontainer/](docs/devcontainer.md) — environment-variable injection paths, `WORKSPACE_ROOT`, DooD

**References** — cross-cutting topics that belong to no single folder live in `docs/reference/`:

- [Tutorial](docs/reference/tutorial.md) — from use cases to tests, walking this seed's design flow from the start (for backend beginners)
- [Conventions](docs/reference/conventions.md) — commit rules, fail-fast, where values live, pnpm script contracts
- [Environment variables](docs/reference/environment.md) — env-variable flow for the Dev Container, API, API docs, and console/user-app, plus the fork checklist
- [Design decisions](docs/reference/decisions.md) — the key design decisions (distributed tooling, the View layer, and more) and the alternatives not taken

**Operations**:

- [GitHub operations setup](docs/github-setup.md) — rulesets, Actions secrets, Dependabot, security features, and scheduled-CI opt-in for a fork
