# nest-seed

[한국어](README.md)

[![Lint and Test](https://github.com/mannercode/nest-seed/actions/workflows/lint-test.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/lint-test.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

_The other guides and code comments are in Korean._

A starter template for NestJS backends with user, file, event, and background-job APIs, plus sign-up and login screens.

## Getting started

The infrastructure is for development and testing. When forking, replace the project name `nest-seed` and organization name `mannercode`, including the `@mannercode` package scope.

**Starting the Dev Container deletes this project's development data.** [What the reset deletes](infra/README.md#2-인프라-시작과-데이터-초기화)

1. Open the repository on the Docker host with VS Code Remote SSH. Run `Reopen in Container` and wait for dependency installation and infrastructure reset.
2. Run `pnpm run lint` and `pnpm test` in the container terminal.
3. Run `pnpm run dev` to start the API and web. From another terminal in the same container, run `curl "http://localhost:${API_PORT}/health"` to check the API.
4. Run `echo "$WEB_PORT"` and forward that port in the VS Code **Ports** panel to open the web app.

### Rebuilding the Dev Container after editing environment files

The Dev Container reads `.env.infra` and `.env.api` from the repository root when it is created. If you edit either file, run **`Rebuild Container`** in VS Code. If you change `API_PORT` in `.env.infra`, update the port in the web development server's `API_BASE_URL` as well. [Web settings](apps/web/.env)

Compose also reads both files when it creates the API container. It treats variable references and quotation marks as part of the value, so write the final value directly, as in `API_PORT=3000`. The development server and tests each set `NODE_ENV`. [API Compose configuration](infra/compose.apps.yml)

## Running and verifying

Run these commands from the repository root inside the Dev Container. Use `pnpm run` to list root commands and `pnpm -C tests run` to list browser E2E workspace commands.

| Command              | Purpose                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `pnpm run dev`       | Run the API and web in watch mode                                            |
| `pnpm test`          | Run unit, integration, API example, and browser E2E tests (restarts Restate) |
| `pnpm run lint`      | Check types, code, formatting, shell scripts, and documentation links        |
| `pnpm run format`    | Format the repository with Prettier                                          |
| `pnpm -C tests test` | Verify the production build of web and its API connection                    |
| `pnpm run race`      | List the multi-replica test scenarios and how to run them                    |
| `pnpm run benchmark` | Compare API performance under the same conditions                            |

`docker compose -f infra/compose.apps.yml up -d --build --wait` starts one API instance and the web app. Append `api` to start the API alone, or `nginx` to start NGINX and four API replicas. Each configuration connects to the running infrastructure. [App Compose file](infra/compose.apps.yml)

Run `bash apps/api/api-docs/run.sh` to check the curl examples against the running dev server. To target the single API container, use `SERVER_URL="http://api:${API_PORT:?}" bash apps/api/api-docs/run.sh`. Pass an example filename to run just that file.

To run a single API integration test file, build the libraries and pass the filename to Vitest.

```bash
pnpm run pretest
pnpm --dir apps/api exec vitest run users.spec
```

## Structure and choices

| Location                                          | Contents                                                        |
| ------------------------------------------------- | --------------------------------------------------------------- |
| [apps/api/](apps/api/README.md)                   | Services, SoLA dependencies, API conventions and usage examples |
| [apps/web/](apps/web/)                            | Photo sign-up, login, profile screens and API proxy             |
| [libs/](libs/README.md)                           | Shared package responsibilities and contracts                   |
| [.devcontainer/](.devcontainer/devcontainer.json) | Dev Container startup commands and VS Code settings             |
| [infra/](infra/README.md)                         | App containers, development infrastructure reset, replica tests |
| [tests/](tests/README.md)                         | Test conventions, coverage, and running browser tests           |
| [tools/](tools/README.md)                         | External access to the web dev server and test tools            |

See [AGENTS.md](AGENTS.md) for repository work and review rules.
