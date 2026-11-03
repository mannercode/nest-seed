# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

_This is a translation of [README.md](README.md). The Korean original is authoritative; the other guides and code comments are in Korean._

A starter template for NestJS backend projects. `apps/api` contains user, file, event, and background-job examples. `apps/web` provides sign-up, login, and profile screens. `libs/` contains shared code for other NestJS projects.

## Getting started

The infrastructure and execution setup are for development and verification. When forking, replace the project name `nest-seed` and organization name `mannercode`, including the `@mannercode/*` package scope.

The supported environment is the Dev Container. Open the repository on a Docker host through VS Code Remote SSH. The workspace must have the same absolute path on the host and inside the container. See the [development environment guide](.devcontainer/README.md).

1. Run `Reopen in Container` in VS Code and wait for dependency installation and infrastructure reset.
2. Run `pnpm run test` in the container terminal.
3. Run `pnpm run dev` to start the API and web, then check `curl http://localhost:3000/health`.
4. Forward port `3200` in the VS Code **Ports** panel to open web. Automatic port forwarding is disabled.

**Dev Container startup, `bash infra/reset.sh`, and `pnpm run atoz` delete MongoDB data, S3 files, the Restate journal, and JetStream events.** Do not run them where data or pending work must survive.

The root `.env.api` and `.env.infra` files contain committed development settings. After editing them, **recreate the Dev Container with `Rebuild Container`.** Inject production secrets outside the repository. See [environment variable injection](.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성).

## Running and verifying

Run commands from the repository root inside the Dev Container. Each includes its required preparation, such as building libraries.

| Command                    | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `pnpm run dev`             | Run the API and web in watch mode                                          |
| `pnpm run test`            | Run workspace unit and integration tests                                   |
| `pnpm run lint`            | Check types, code, formatting, shell scripts, and documentation links      |
| `pnpm run atoz`            | Reset infrastructure, then run builds, tests, browser checks, and API docs |
| `pnpm run api-docs`        | Verify bash and curl documentation against four API replicas               |
| `pnpm run e2e`             | Verify the production build of web and its API connection                  |
| `pnpm run race <scenario>` | Verify HTTP/SSE contention and replica termination                         |
| `pnpm run benchmark`       | Compare API performance under the same conditions                          |

Race and benchmark runs are not part of the default test or AtoZ commands. Concurrent runs of the same API Vitest command are unsupported. The [tests guide](tests/README.md) explains the guarantees and limits of each suite.

### Selected runs and external access

For a selected API spec, first build the libraries and disable coverage for the partial run. Before completing a change, pass the workspace's full test suite and coverage checks.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

Use `bash apps/api/api-docs/run.sh` to run the [curl documentation](apps/api/api-docs/) against a running development API. Append a filename such as `registration-photo.spec` to run one document.

`pnpm run race` lists scenarios, and `pnpm run e2e:list` lists browser tests. Use `pnpm run e2e:ui` to select and run browser tests interactively. See the [development environment guide](.devcontainer/README.md#3-시작-순서와-데이터-초기화) for Chromium installation and version changes.

To access web externally, start the development server and run `pnpm exec tunnel` in another terminal. cloudflared provides an HTTPS Quick Tunnel URL. See the [tunnel requirements](tools/README.md#2-dev-tools--명시적으로-실행하는-개발-도구).

### Results and diagnostics

| Check                   | Results                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Unit, integration, race | Terminal; failed races collect container and MongoDB diagnostics before cleanup           |
| Browser                 | Traces, screenshots, and HTML under `tests/web/_output/`; open with `pnpm run e2e:report` |
| Curl documentation      | `logs/` and `docs/summary.md` under `apps/api/api-docs/_output/`                          |
| Benchmark               | `report.html` and `summary.json` under `tests/api/benchmark/_output/<run timestamp>/`     |

Find failed CI iterations by their `[Run i/N]` marker. Measurement data remains after stack shutdown; use [infra reset](infra/README.md#2-인프라-시작과-데이터-초기화) to delete it.

## Structure and choices

| Location                                  | Guide contents                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| [apps/](apps/README.md)                   | Seed scope, sign-up, authentication, event and job guarantees, web BFF |
| [apps/api/](apps/api/README.md)           | Services, SoLA dependencies, API conventions                           |
| [libs/](libs/README.md)                   | Shared package responsibilities and contracts                          |
| [.devcontainer/](.devcontainer/README.md) | Development environment, env changes, shared host paths                |
| [infra/](infra/README.md)                 | Development infrastructure and data reset                              |
| [tests/](tests/README.md)                 | Test conventions and verification scope                                |
| [tools/](tools/README.md)                 | Development and test execution tools                                   |

See [AGENTS.md](AGENTS.md) for repository work and review rules.
