# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

_This is a translation of [README.md](README.md). The Korean original is authoritative._

A NestJS monorepo used as the starting point for production projects. Follow a familiar movie-booking flow to read and run examples of module boundaries, contention across replicas, duplicate requests, partial failure, and recovery. `apps/api` is the main application; `console` and `user-app` are minimal Next.js integration demos.

The seed connects examples, design decisions, and verification through one coherent flow:

- **Connected examples in one domain** — movie and theater CRUD leads into seat holds, purchases, and showtime creation, introducing concurrency, idempotency, and recovery step by step. Domain features illustrate design patterns that can be reused in other projects.
- **Module boundaries applied where needed** — SoLA (Service-oriented Layered Architecture) is a design convention that restricts dependencies between modules to lower layers and composes peer modules in a higher layer to prevent cycles. Each domain owns its collection and collaborates through IDs and public APIs. Gateway calls Core directly for CRUD that needs only one Core, avoiding an unnecessary Application service.
- **Distributed execution within a monolith** — multiple replicas of the same API handle seat contention, duplicate requests, and events across replicas. This exposes the distributed design concerns that arise even within a single application.
- **Guarantees and recovery suited to the problem** — Redis locks reduce contention cost, while atomic DB transitions, CAS, and transactions preserve consistency. Purchases use a state machine and lease reconciliation; showtime creation uses a Restate workflow. The examples show how recovery approaches fit different problems.
- **A development environment for verifying changes** — the Dev Container uses real infrastructure, including MongoDB Replica Set and Redis Cluster. Integration tests, race tests across replicas, and repeated CI runs verify changes. The 100% coverage gate makes unexecuted branches visible when they are introduced.
- **Documentation that supports execution and decisions** — executable API scenarios show actual request and response flows, while design decisions explain choices, alternatives, and limitations. Together they help you decide what to retain or change for your own project.

See [apps](docs/apps.md) for layers and distributed boundaries and [design decisions](docs/reference/decisions.md) for reasoning and limitations.

## 1. Getting started

The Dev Container is the only supported development path. You need Docker and the VS Code Dev Containers extension.

1. Open the repository in VS Code and run `Reopen in Container`. The first boot may take a while while images and development infrastructure are prepared.
2. Run `pnpm run test`. Use `pnpm run atoz` after forking or when you need to verify every boundary.
3. Run `pnpm run dev`, then check the API with `curl http://localhost:3000/health`.
4. Sign in to the console (3100) with the development admin (`admin@nest-seed.local` / `DevPass1!`) and create movies and theaters. The Dev Container recreates this account whenever it resets the infrastructure.
5. Use the user app (3200) to explore sign-up, login, and the composed home view. The executable API docs run showtime, booking, and purchase APIs through an independent fixture flow.

`.env.api` and `.env.infra` contain committed development and verification values. Review project identifiers and credentials when forking, and inject production secrets outside the repository. See [Environment variables](docs/reference/environment.md).

## 2. Main commands

| Command               | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `pnpm run dev`        | Run the API and both frontends in watch mode                    |
| `pnpm run test`       | Run workspace unit, integration, and contract tests             |
| `pnpm run lint`       | Check types, code, formatting, shell, and documentation links   |
| `pnpm run atoz`       | Run the full regression after forking or before deployment      |
| `bash infra/reset.sh` | Recreate development infrastructure and the fixed admin fixture |
| `pnpm run api-docs`   | Check API docs across replicas                                  |
| `pnpm exec tunnel`    | Run Quick Tunnels for the console and user app                  |

`infra/reset.sh` deletes the volumes and then recreates the fixed admin fixture. It also deletes the Restate journal and JetStream data, so it must not be used where executions need to survive. Test-specific commands and output locations are in [tests/README.md](tests/README.md).

## 3. API reference

Instead of static Swagger/OpenAPI, `apps/api/api-docs/*.spec` sends real requests and serves as the HTTP contract for representative success and failure paths. This prevents documentation from silently drifting away from behavior.

```bash
bash apps/api/api-docs/run.sh
bash apps/api/api-docs/run.sh showtime-creation.spec
```

Each `TEST` detail log records the actual response body. The spec itself shows the request, while preparation-only `SETUP` calls are not documentation entries. Long-lived SSE and infrastructure failure paths are covered by integration tests. See [Executable API docs](docs/apps.md#5-실행-가능한-api-문서) for the detailed conventions.

## 4. Project structure

```text
.
├── apps/
│   ├── api/             # NestJS API
│   ├── console/         # Admin-facing Next.js application
│   └── user-app/        # User-facing Next.js application
├── libs/
│   ├── common/          # Shared runtime code used by applications
│   └── testing/         # Client and fixture helpers for test consumers
├── tests/
│   ├── api/             # Shared multi-replica stack, race, and benchmark
│   └── web/             # Browser E2E
├── infra/               # Development MongoDB, Redis, S3, NATS, Restate, and their tests
│   └── tests/           # Infrastructure recovery and consistency guarantees
├── tools/               # Development and test orchestration tools
└── docs/                # Human-oriented design and operations documentation
```

## 5. Technology choices

| Role                                     | Choice                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| API and frontends                        | NestJS, Next.js, Zod                                   |
| Primary data and atomicity               | MongoDB Replica Set, official Node.js driver           |
| Contention, messaging, durable execution | Redis Cluster, NATS/JetStream, Restate                 |
| Object storage                           | AWS SDK with the S3-compatible VersityGW               |
| Verification                             | Vitest, Testcontainers, Playwright, k6, Docker Compose |

These tools own different failure boundaries; they are not included merely as a technology showcase. [Design decisions](docs/reference/decisions.md) explains why this combination was chosen and why Kafka, BullMQ, Swagger, Nx, and others were not.

## 6. Domain tour

Start with the simple CRUD in `core/theaters`, then read the Core composition in `application/booking`, followed by the durable workflow in `application/showtime-creation`. Read each implementation beside its integration test of the same name.

| Area                                  | Concept demonstrated                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `core/movies`, `core/theaters`        | Basic domain structure, publish state, file association                   |
| `core/users`, `core/admins`           | Role-specific auth, token rotation, soft delete and unique indexes        |
| `core/tickets`, `core/ticket-holding` | Atomic state transitions and Redis Lua seat holds                         |
| `application/booking`                 | A user journey composed from several Core services                        |
| `application/showtime-creation`       | 202, Restate workflow, status/SSE, transactions and CAS                   |
| `application/purchase`                | Idempotent responses, durable state machine, lease reconciliation, outbox |
| `application/recommendation`          | Watch-history recommendations and pure domain logic                       |
| `view/user-app/home`                  | Screen-specific read-model composition                                    |
| `infrastructure/assets`, `payments`   | S3 and external-payment boundaries                                        |

## 7. Authorization

There are two application roles. **admin** manages content and operations targeting arbitrary users, while **user** can access only its own resources. The initial admin is provisioned through an operational command rather than HTTP. Admin and user tokens use different signing secrets.

Self-owned resources use `/me` paths whose identity is fixed to the token subject. Any path accepting an arbitrary user ID is admin-only. Together these rules remove IDOR paths where a user could substitute someone else's ID.

## 8. Production scope

`tests/api/compose.yml` exercises distributed behavior; it is not a production deployment. It does not provide TLS, secret management, backup/restore, an observability backend, a frontend edge, or zero-downtime revision rollout. Restate endpoint versioning and the BFF proxy-IP trust boundary require deployment-specific design. See [API stack](docs/api-stack.md) for the relevant hazards and guarantee limits.

## 9. Documentation

Korean is the source language for documentation and comments. Only this README is translated.

- [apps](docs/apps.md) — SoLA layers, distributed guarantees, API and test conventions
- [libs](docs/libs.md) — boundary between runtime shared code and test helpers
- [tests](docs/tests.md) — why external-stack verification exists and how to interpret it
- [infra](docs/infra.md) — development topology and the destructive reset boundary
- [API stack](docs/api-stack.md) — multi-replica verification and boundaries that must not be copied into production
- [devcontainer](docs/devcontainer.md) — the single development path, DooD constraints, and security
- [decisions](docs/reference/decisions.md) — choices, alternatives, and non-guarantees
- [development rules](docs/reference/conventions.md) — rules automation cannot enforce
- [environment](docs/reference/environment.md) — env ownership and injection timing

For the design background of the movie-booking domain, see the blog series [Backend Service Analysis and Design 1](https://mannercode.com/2025/04/01/backend-design-1.html), [2](https://mannercode.com/2025/05/01/backend-design-2.html), and [3](https://mannercode.com/2025/06/01/backend-design-3.html).
