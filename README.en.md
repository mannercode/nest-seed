# nest-seed

[한국어](README.md)

[![Lint and Test](https://github.com/mannercode/nest-seed/actions/workflows/lint-test.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/lint-test.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

A starter for NestJS backends. Photo sign-up shows how a browser request goes through the web proxy and API to create an account and assign ownership of the photo. The event example delivers messages to connected users. The background-job example lets a caller look up a result after the original request ends. [API architecture](apps/api/README.md#sola의-모듈-의존-방향) · [Web app](apps/web/README.md)

The bundled infrastructure is for development and testing. When forking, replace the project name `nest-seed` and organization name `mannercode`, including the `@mannercode` package scope. The design guides and code comments are in Korean.

## Getting started

**Every Dev Container start deletes this project's development accounts, sessions, uploaded files, messages, and workflow history.** To reset them manually, run `pnpm -C infra run reset`. [Dev Container configuration](.devcontainer/devcontainer.json) · [Reset script](infra/reset.sh)

1. Open the repository on the Docker host with VS Code Remote SSH and run `Reopen in Container`. Give each copy a distinct folder name if you open several on one host under the same user.
2. After setup finishes, run `pnpm -C apps/api run dev` and `pnpm -C apps/web run dev` in separate container terminals.
3. Check the API with `curl -fsS "http://localhost:${API_PORT:?}/health"`. Run `echo "$WEB_PORT"` and forward that port in the VS Code **Ports** panel to open the web app. To try photo uploads from another device, run `pnpm exec tunnel` in the repository root and open the HTTPS URL.

Docker reads [.env.infra](.env.infra) and [.env.api](.env.api) when it creates the container. Write final values such as `API_PORT=3000` without quotes or variable references. After editing either file, run `Rebuild Container` in VS Code. This also resets the development data.

## Running and verifying

Run `pnpm run lint && pnpm test` in the Dev Container for the same checks as CI. The suite restarts the shared Restate server during its recovery test. Running `test:api-docs`, browser E2E, a race scenario, or the benchmark stops the current app containers before starting the test stack. [CI workflow](.github/workflows/lint-test.yaml) · [Commands for individual checks](README.md#실행과-검증)

Run `bash apps/api/api-docs/run.sh users.spec` against the running dev API to send the sign-up requests and save a report of their HTTP status codes. For replica tests, `pnpm -C infra run race` lists the available scenarios. [Curl sign-up example](apps/api/api-docs/users.spec) · [Distributing the runnable examples](apps/api/README.md#실행-가능한-api-문서) · [App containers and benchmarks](README.md#앱-컨테이너와-복제본-검증)

## Structure and choices

- [API services and SoLA design](apps/api/README.md) · [Web app and proxy](apps/web/README.md) · [Shared package contracts](libs/README.md)
- [Development infrastructure](infra/compose.yml) · [Restate deployment addresses](README.md#restate-배포-주소) · [Vitest helpers](tools/vitest-helpers/index.js)
- [Repository and test-writing guidelines](AGENTS.md)
