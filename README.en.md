# nest-seed

[한국어](README.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

_The Korean README is the source for this translation. The other guides and code comments are in Korean._

A starter template for NestJS backend projects. `apps/api` contains user, file, event, and background-job examples. `apps/web` provides sign-up, login, and profile screens. `libs/` contains shared code for other NestJS projects.

## Getting started

The infrastructure and execution setup are for development and verification. When forking, replace the project name `nest-seed` and organization name `mannercode`, including the `@mannercode/*` package scope.

The supported environment is the Dev Container. Open the repository on a Docker host through VS Code Remote SSH. The workspace must have the same absolute path on the host and inside the container. See the [development environment guide](.devcontainer/README.md).

**Starting the Dev Container resets this project's development infrastructure every time.** This deletes accounts, sessions, uploaded files, events, and pending jobs. `pnpm run atoz` runs the same [reset script](infra/README.md#2-인프라-시작과-데이터-초기화).

1. Run `Reopen in Container` in VS Code and wait for dependency installation and infrastructure reset.
2. Run `pnpm run test` in the container terminal.
3. Run `pnpm run dev` to start the API and web. In a second container terminal, run `curl "http://localhost:${API_PORT}/health"` to check the API.
4. Run `echo "$WEB_PORT"` and forward that port in the VS Code **Ports** panel to open the web app.

After editing `.env.api` or `.env.infra` at the repository root, run `Rebuild Container` in VS Code. [Environment variable setup](.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성)

## Running and verifying

Run these commands from the repository root inside the Dev Container. Use `pnpm run` for the full list.

| Command              | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `pnpm run dev`       | Run the API and web in watch mode                                     |
| `pnpm run test`      | Run workspace unit and integration tests                              |
| `pnpm run lint`      | Check types, code, formatting, shell scripts, and documentation links |
| `pnpm run format`    | Format the repository with Prettier                                   |
| `pnpm run atoz`      | Initialize the test environment and run the standard CI checks        |
| `pnpm run api-docs`  | Send the curl examples to a running API and check the responses       |
| `pnpm run e2e`       | Verify the production build of web and its API connection             |
| `pnpm run race`      | List the multi-replica test scenarios and how to run them             |
| `pnpm run benchmark` | Compare API performance under the same conditions                     |

To check formatting alone, run `pnpm run lint:format`. [What each suite covers](tests/README.md#검증-범위)

### Selected runs and external access

To run one API integration test file, build the libraries and pass the filename to Vitest. Run `pnpm run test` to check full coverage.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

With the development API running, pass a filename to run a single example, such as `pnpm run api-docs users.spec`. [API usage examples](apps/api/README.md#실행-가능한-api-문서)

Use `pnpm run e2e:list` to list browser tests and `pnpm run e2e:report` to open the report. To select and run a test interactively, run `pnpm run e2e:ui` and forward `e2e:<port printed by the UI>` in the VS Code Ports panel. [Browser E2E environment](tests/README.md#브라우저-e2e)

To access web externally, start the development server and run `pnpm exec tunnel` in another terminal. cloudflared provides an HTTPS Quick Tunnel URL. See the [tunnel requirements](tools/README.md#2-dev-tools--명시적으로-실행하는-개발-도구).

## Structure and choices

| Location                                  | Contents                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| [apps/api/](apps/api/README.md)           | Services, SoLA dependencies, API conventions and usage examples |
| [apps/web/](apps/web/)                    | Photo sign-up, login, profile screens and API proxy             |
| [libs/](libs/README.md)                   | Shared package responsibilities and contracts                   |
| [.devcontainer/](.devcontainer/README.md) | Development environment, env changes, shared host paths         |
| [infra/](infra/README.md)                 | Development infrastructure and data reset                       |
| [tests/](tests/README.md)                 | Test conventions and verification scope                         |
| [tools/](tools/README.md)                 | Development and test execution tools                            |

See [AGENTS.md](AGENTS.md) for repository work and review rules.
