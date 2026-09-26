# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

_This is a translation of [README.md](README.md). The Korean original is authoritative; the other guides and code comments are in Korean._

A starting point you can copy and adapt for a NestJS project. `apps/api` is the main API, and `libs/` contains common code for use in other NestJS projects. The movie-booking example demonstrates cooperation between modules, data consistency, and external service integration. `console` and `user-app` are small Next.js demos connected to the API.

Start with simple CRUD, then explore module composition and asynchronous processing.

| Code to read                                                              | What it demonstrates                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [theaters](apps/api/src/services/core/theaters/)                          | Basic service, repository, and DTO structure                                             |
| [booking](apps/api/src/services/application/booking/)                     | A use case that combines public APIs from several domains                                |
| [home](apps/api/src/services/view/user-app/home/)                         | Combining reads for a screen-specific response                                           |
| [showtime-creation](apps/api/src/services/application/showtime-creation/) | Asynchronous submission, Restate execution, DB transactions, and SSE                     |
| [purchase](apps/api/src/services/application/purchase/)                   | Buying tickets for one showtime, idempotency, compensation, and completion notifications |

Read each implementation alongside its [API integration test](apps/api/src/__tests__/) of the same name to check accepted inputs, response shapes, and stored results. Integration with a real payment provider, a cinema model with multiple screening rooms, and a complete booking UI are outside the scope of this seed.

## Getting started

When forking for a new project, replace the project name `nest-seed` and organization name `mannercode`, including the `@mannercode/*` package scope, with your own names.

The supported development environment is the Dev Container. Open the repository on a Docker host through VS Code Remote SSH and use the Dev Containers extension. The [development environment guide](docs/devcontainer.md) explains why the workspace must have the same absolute path on the host and inside the container.

1. Run `Reopen in Container` in VS Code. Startup installs dependencies and resets the development infrastructure.
2. Run `pnpm run test` in the container terminal.
3. Run `pnpm run dev` and check the API with `curl http://localhost:3000/health`.
4. Forward the console's port `3100` and the user app's port `3200` in the VS Code **Ports** panel. Automatic port forwarding is disabled.
5. Sign in to the console with the development admin (`admin@nest-seed.local` / `DevPass1!`). Use the user app to explore sign-up, login, and the home screen.

Dev Container startup, `bash infra/reset.sh`, and `pnpm run atoz` delete development data. Do not run them in an environment where DB data, S3 files, the Restate journal, or JetStream events must survive. Resets also recreate the development admin.

The root `.env.api` and `.env.infra` files contain committed development and verification settings. After editing either file, recreate the Dev Container to apply the changes. Inject production secrets outside the repository. The [development environment guide](docs/devcontainer.md) explains each file's role and how its values are injected.

## Running and verifying

Run these commands from the repository root inside the Dev Container. Each command includes its required preparation, such as building libraries.

| Command                    | Purpose                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `pnpm run dev`             | Run the API and both demos in watch mode                                     |
| `pnpm run test`            | Run workspace unit and integration tests                                     |
| `pnpm run lint`            | Check types, code, formatting, shell scripts, and documentation links        |
| `pnpm run atoz`            | Reset infrastructure, then run builds, tests, browser checks, and API docs   |
| `pnpm run api-docs`        | Verify executable documentation against a four-replica API stack             |
| `pnpm run e2e`             | Verify the production builds of the demos and their API connections          |
| `pnpm run race <scenario>` | Run HTTP/SSE contention or replica termination scenarios across API replicas |
| `pnpm run benchmark`       | Compare API performance under the same conditions                            |

Race and benchmark runs are not part of the default test or AtoZ commands. Concurrent runs of the same API Vitest command are unsupported. The 100% coverage requirement exposes code paths that tests have not executed; repeated CI runs look for intermittent failures. The [tests guide](docs/tests.md) explains what each suite verifies.

### Running selected tests

To run a particular API spec, first build the libraries, then specify a test file pattern. Disable coverage collection for this partial run because selected tests cannot cover the entire workspace. Before completing a change, run the workspace's full test suite and coverage checks again.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

API usage examples are in the bash and curl specs under [api-docs](apps/api/api-docs/). You can also verify all documents or a selected document against a running development API.

```bash
bash apps/api/api-docs/run.sh
bash apps/api/api-docs/run.sh showtime-creation.spec
```

The specs contain requests, and the execution logs contain actual responses. These documents demonstrate the main success and failure flows; they do not replace a complete API catalog or the integration tests.

`pnpm run race` lists race scenarios, and `pnpm run e2e:list` lists browser tests. Use `pnpm run e2e:ui` to select and run browser tests interactively.

When changing the Playwright version, update Chromium and its required OS packages too. Follow the [development environment guide](docs/devcontainer.md#3-시작-순서와-데이터-수명) to rebuild the Dev Container. Dev Container startup and AtoZ install Chromium. To reinstall Chromium alone, run:

```bash
pnpm --filter './tests/web' exec playwright install chromium
```

### Results and diagnostics

- Unit, integration, and race results appear in the terminal. If a race fails, the runner collects container and MongoDB diagnostics before cleaning up the test stack.
- Browser traces, screenshots, and HTML reports are in `tests/web/_output/`. Open the latest report with `pnpm run e2e:report`.
- Under `apps/api/api-docs/_output/`, actual responses are in `logs/` and the executed-item summary is in `docs/summary.md`.
- Benchmarks write `report.html` and `summary.json` to `tests/api/benchmark/_output/<run timestamp>/`. Measurement theater data stays in the DB; use `bash infra/reset.sh` to clear it.

Find the failed iteration of a repeated CI run by its `[Run i/N]` marker. For API Race failures, compare the runner's diagnostics with container logs from the same time.

## Structure and choices

The API follows SoLA dependencies from Gateway → View → Application → Core → Infrastructure. A layer can call a lower layer directly without passing through intermediate layers. A higher layer combines modules from the same lower layer. CRUD within a single Core does not need an Application layer.

MongoDB handles data storage and transactions; Redis handles seat holds and refresh sessions. NATS delivers real-time messages, JetStream preserves messages for later processing, and Restate resumes interrupted work. SDK connections and calls live in common; business queries, policies, and workflow steps live in the API. See [design decisions](docs/reference/decisions.md) for the reasons and limitations.

| Location         | Guide                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| `apps/`          | [Module boundaries, business flows, authentication, and DTOs](docs/apps.md)    |
| `libs/`          | [Shared code and public contracts](docs/libs.md)                               |
| `tests/`         | [Scope of multi-process, browser, and performance verification](docs/tests.md) |
| `infra/`         | [Development infrastructure and what reset removes](docs/infra.md)             |
| `tools/`         | [Development and test execution tools](docs/tools.md)                          |
| `.devcontainer/` | [Development environment and env injection](docs/devcontainer.md)              |

Follow the [development conventions](docs/reference/conventions.md) when writing code and the [project change and review criteria](docs/reference/project-review.md) when assessing changes. Keep tasks and unresolved reviews in the root `_todo/` directory.

## Production scope

The provided infrastructure and execution setup are for development and verification. They do not include production TLS, backups, monitoring, or zero-downtime deployment.

- To forward user IP addresses through the demos, the proxy must supply the actual connection IP, and direct access that bypasses it must be blocked. Follow the [client IP forwarding setup](docs/apps.md#데모와-bff).
- When deploying workflow code while purchases or showtime creations are still running, keep the previous code available until those executions finish. Follow the [deployment procedure for preserving running workflows](docs/reference/decisions.md#배포-revision).
