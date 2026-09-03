# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)

_This is a translation of [README.md](README.md). The Korean original is authoritative._

A NestJS monorepo used as the starting point for production projects. Its familiar movie-booking domain demonstrates module boundaries inside a monolith as well as contention, partial failure, and asynchronous job tracking across replicas. `apps/api` is the main application; `console` and `user-app` are minimal Next.js integration demos.

Four ideas define the seed:

- **Five SoLA layers** — modules in the same layer do not call each other directly. Composition moves to a higher layer, and HTTP controllers live in Gateway.
- **Service-owned data boundaries** — each domain accesses only its own collection and collaborates through IDs and public APIs. MongoDB fits this document-oriented model.
- **Separated distributed guarantees** — Redis locks reduce contention cost; DB transitions, CAS, and transactions preserve consistency. Restate resumes interrupted work, while NATS carries messages across processes.
- **Behavior-oriented verification** — integration tests use real infrastructure and race tests exercise multiple replicas. The 100% coverage gate is not a bug-free certificate; it prevents untested branches from remaining anonymous.

See [apps](docs/apps.md) for layers and distributed boundaries and [design decisions](docs/reference/decisions.md) for reasoning and limitations.

## 1. Getting started

The Dev Container is the only supported development path. You need Docker and the VS Code Dev Containers extension. The minimum specification is 4 CPU cores, 16GB RAM, and 32GB disk; 32GB+ RAM is recommended for full verification.

1. Open the repository in VS Code and run `Reopen in Container`. The first boot may take a while while images and development infrastructure are prepared.
2. Run `pnpm run test`. Use `pnpm run atoz` after forking or when you need to verify every boundary.
3. Run `pnpm run dev`, then check the API with `curl http://localhost:3000/health`.
4. No admin exists initially. Create one using the development root account. The username is `root`; the password is `ROOT_PASSWORD` from `.env.api`.

    ```bash
    curl -u "root:${ROOT_PASSWORD}" -H 'Content-Type: application/json' \
        -d '{"email":"admin@example.com","password":"admin1234!","name":"Admin"}' \
        http://localhost:3000/admins
    ```

5. Create movies and theaters in the console (3100), then use the executable API docs for showtime, booking, and purchase flows. The user app (3200) demonstrates sign-up, login, and the composed home view.

`.env.api` and `.env.infra` contain committed development defaults. Review project identifiers and credentials when forking, and inject production secrets outside the repository. See [Environment variables](docs/reference/environment.md).

## 2. Main commands

| Command                 | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `pnpm run dev`          | Run the API and both frontends in watch mode                   |
| `pnpm run test`         | Run workspace unit, integration, and contract tests            |
| `pnpm run lint`         | Check types, code, formatting, shell, and documentation links  |
| `pnpm run atoz`         | Run the full regression after forking or before deployment     |
| `bash infra/reset.sh`   | Recreate development infrastructure, including volumes         |
| `bash deploy/verify.sh` | Start, verify, and remove the multi-replica verification stack |

`infra/reset.sh` also deletes the Restate journal and JetStream data. It is a development recovery command and must not be used where executions need to survive. Test-specific commands and output locations are in [tests/README.md](tests/README.md).

## 3. API reference

Instead of static Swagger/OpenAPI, `apps/api/api-docs/*.spec` sends real requests and serves as the success-path API contract. This prevents documentation from silently drifting away from behavior.

```bash
bash apps/api/api-docs/run.sh
bash apps/api/api-docs/run.sh showtime-creation.spec
```

Generated request/response logs are diagnostic output, not public documentation artifacts. Long-lived SSE and failure paths are covered by integration tests. See [Executable API docs](docs/apps.md#5-실행-가능한-api-문서) for conventions and security boundaries.

## 4. Project structure

```text
apps/           NestJS API and Next.js console/user-app
libs/           Shared runtime code and test-consumer helpers
tests/          Race, browser, and benchmark checks outside a deployed stack
infra/          Development MongoDB, Redis, S3, NATS, and Restate
deploy/         Multi-replica API + NGINX verification stack
tools/          Development and test orchestration tools
docs/           Human-oriented design and operations documentation
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

There are three roles. **root** uses Basic auth from the development environment only to create and delete admins; **admin** manages content and operations targeting arbitrary users; **user** can access only its own resources. Admin and user tokens use different signing secrets.

Self-owned resources use `/me` paths whose identity is fixed to the token subject. Any path accepting an arbitrary user ID is admin-only. Together these rules remove IDOR paths where a user could substitute someone else's ID.

## 8. Deployment scope

`deploy/` is a distributed-behavior reference stack, not a production deployment. It does not provide TLS, secret management, backup/restore, an observability backend, a frontend edge, or zero-downtime revision rollout. Restate endpoint versioning and the BFF proxy-IP trust boundary require deployment-specific design. See [deploy](docs/deploy.md) for the relevant hazards and guarantee limits.

## 9. Documentation

Korean is the source language for documentation and comments. Only this README is translated.

- [apps](docs/apps.md) — SoLA layers, distributed guarantees, API and test conventions
- [libs](docs/libs.md) — boundary between runtime shared code and test helpers
- [tests](docs/tests.md) — why external-stack verification exists and how to interpret it
- [infra](docs/infra.md) — development topology and the destructive reset boundary
- [deploy](docs/deploy.md) — multi-replica verification and boundaries that must not be copied into production
- [devcontainer](docs/devcontainer.md) — the single development path, DooD constraints, and security
- [decisions](docs/reference/decisions.md) — choices, alternatives, and non-guarantees
- [conventions](docs/reference/conventions.md) — project rules automation cannot enforce
- [environment](docs/reference/environment.md) — env ownership, recreation, forking, and exposure boundaries

For the design background of the movie-booking domain, see the blog series [Backend Service Analysis and Design 1](https://mannercode.com/2025/04/01/backend-design-1.html), [2](https://mannercode.com/2025/05/01/backend-design-2.html), and [3](https://mannercode.com/2025/06/01/backend-design-3.html).
