# 환경 변수

이 저장소의 공식 개발 경로는 Dev Container이다. 로컬 직접 실행을 별도 지원 경로로 두지 않는다. 환경 변수도 Dev Container, Docker Compose, 테스트 실행기가 함께 쓰는 값을 기준으로 나뉘어 있다.

---

## 1. 파일 역할

| 파일                     | 읽는 곳                                                        | 역할                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env.infra`             | Dev Container `runArgs`, `infra` compose, `deploy/compose.yml` | 개발 인프라 이미지 태그와 접속 값. MongoDB, Redis, MinIO, NATS, Temporal 서비스 이름·포트와 dev 서버 포트(`API_PORT`, `CONSOLE_PORT`, `USER_APP_PORT`)를 정의한다. |
| `.env.api`               | Dev Container `runArgs`, `deploy/compose.yml` `env_file`       | API 런타임의 앱 설정. `NODE_ENV`(개발·테스트는 test, deploy가 production으로 덮어씀), `PROJECT_ID`, HTTP, 인증, 로그 값, `ROOT_PASSWORD`를 둔다.                   |
| `apps/api/api-docs/.env` | `apps/api/api-docs/run.sh`                                     | curl 기반 API 문서 실행 설정. `SERVER_URL`과 업로드 fixture 값을 둔다.                                                                                             |
| `apps/console/.env`      | Next.js console                                                | 관리 콘솔이 호출할 API 기준 URL을 둔다.                                                                                                                            |
| `apps/user-app/.env`     | Next.js user-app                                               | 사용자 앱이 호출할 API 기준 URL을 둔다.                                                                                                                            |

`.env` 파일은 역할별로 분리한다. 인프라가 소유한 값은 `.env.infra`, API가 소유한 값은 `.env.api`에 둔다.

---

## 2. 값 흐름

Dev Container가 시작될 때 `.devcontainer/devcontainer.json`은 `.env.infra`와 `.env.api`를 `runArgs --env-file`로 컨테이너 환경에 주입하고, `containerEnv`로 `WORKSPACE_ROOT`, `COMPOSE_PROJECT_NAME`도 함께 세팅한다.

`--env-file`은 컨테이너 생성 시점에 평가된다. 두 파일의 값을 바꾸면 Dev Container를 Rebuild해야 반영된다. 또한 docker env-file은 셸이 아니라서 따옴표를 값에 그대로 포함시키고 `${...}` 보간도 하지 않는다.

```
Dev Container
  -> .env.infra, .env.api
  -> process.env 안의 NODE_ENV, API_PORT, CONSOLE_PORT, USER_APP_PORT, HTTP_*, AUTH_*, ROOT_PASSWORD, MONGO_*, REDIS_*, S3_*, NATS_*, TEMPORAL_*
```

`postStartCommand`는 `infra/reset.sh`를 실행한다. 이 스크립트는 `infra`의 compose 파일들로 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal을 시작한다. 이미지 태그와 `S3_BUCKET`·`TEMPORAL_NAMESPACE`는 ambient한 `.env.infra` 변수로 보간되고, 서비스 이름·포트는 compose 파일의 리터럴이다(그래서 3절의 포트 표가 필요하다).

API는 Nest `ConfigModule`에서 `.env` 파일을 직접 읽지 않는다. `ignoreEnvFile: true`로 두고, 실행 경로가 준비한 `process.env`만 검증한다. Dev Container가 두 `.env`를 미리 주입했으므로 모든 워크스페이스의 npm 프로세스는 그 환경을 그대로 상속한다.

```
apps/api 통합 테스트 (npm test -w apps/api)
  -> Dev Container 환경의 .env.api + .env.infra가 이미 ambient
  -> jest는 추가 .env 로드 없이 그 process.env로 동작

deploy/verify.sh
  -> docker compose가 service의 env_file로 ../.env.infra, ../.env.api를 자동 inject
  -> deploy/compose.yml이 API replica와 NGINX 실행
  -> verify.sh는 run.sh에 SERVER_URL만 넘긴다 (ROOT_PASSWORD는 Dev Container가 주입한 환경에서 상속)

apps/api/api-docs/run.sh
  -> apps/api/api-docs/.env 로드
  -> SERVER_URL 대상에 curl 요청 실행
  -> _output/logs, _output/docs 산출
```

---

## 3. 포트 표 — 같이 바꿔야 할 곳

env 파일은 자기 보간이 안 되고 compose 서비스 정의와 스크립트에는 리터럴이 남으므로, 일부 값은 짝으로 맞춰야 한다. 아래 값을 바꿀 때는 짝을 함께 바꾼다.

| 값                             | 정의처                                                                             | 같이 바꿔야 할 곳                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 포트 3000                  | `.env.infra` `API_PORT`                                                            | `apps/console/.env`·`apps/user-app/.env`의 `API_BASE_URL`, `deploy/nginx.conf`의 upstream `api:3000`, README (tunnel.sh·api predev·playwright·deploy healthcheck는 자동 추종) |
| console 포트 3100              | `.env.infra` `CONSOLE_PORT`                                                        | README (package.json 스크립트·tunnel.sh·playwright는 자동 추종)                                                                                                               |
| user-app 포트 3200             | `.env.infra` `USER_APP_PORT`                                                       | README (package.json 스크립트·tunnel.sh는 자동 추종)                                                                                                                          |
| Mongo `mongo1~3:27016`         | `infra/compose.mongo.yml`                                                          | `.env.infra` `MONGO_URI`                                                                                                                                                      |
| Redis `redis1~3:6379`          | `infra/compose.redis.yml`                                                          | `.env.infra` `REDIS_HOST1~3`/`REDIS_PORT1~3`                                                                                                                                  |
| NATS `nats:4222`               | `infra/compose.nats.yml` 서비스 이름(4222는 NATS 기본 포트라 파일에 리터럴이 없다) | `.env.infra` `NATS_HOST`/`NATS_PORT`                                                                                                                                          |
| Temporal `temporal:7233`       | `infra/temporal/compose.temporal.yml`                                              | `.env.infra` `TEMPORAL_HOST`/`TEMPORAL_PORT`                                                                                                                                  |
| MinIO `minio:9000`, 콘솔 9001  | `infra/compose.minio.yml`                                                          | `.env.infra` `S3_ENDPOINT`/`S3_CONSOLE_ENDPOINT`                                                                                                                              |
| 배포 NGINX `http://nginx` (80) | `deploy/compose.yml`·`deploy/nginx.conf`                                           | `deploy/verify.sh`·`tests/api-race/runner.sh`의 `SERVER_URL`                                                                                                                  |

---

## 4. 포크할 때 확인할 값

새 프로젝트로 가져갈 때는 저장소 전체에서 `nest-seed`를 검색해 새 프로젝트 이름으로 모두 바꾸고, `mannercode`를 검색해 새 조직 이름과 내부 패키지 스코프로 모두 바꾼다. 그다음 환경별 식별자를 확인한다.

| 위치                 | 확인할 값                                                       |
| -------------------- | --------------------------------------------------------------- |
| 저장소 전체 검색     | `nest-seed` → 새 프로젝트 이름                                  |
| 저장소 전체 검색     | `mannercode` → 새 조직 이름(`@mannercode/*` 패키지 스코프 포함) |
| `package.json`       | `name`                                                          |
| `.env.api`           | `PROJECT_ID`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `ROOT_PASSWORD`   |
| `.env.infra`         | `MONGO_DATABASE`, `S3_BUCKET`, `TEMPORAL_NAMESPACE`             |
| `deploy/compose.yml` | API image 이름, 필요하면 replica 기본값                         |
| `apps/console/.env`  | `API_BASE_URL`                                                  |
| `apps/user-app/.env` | `API_BASE_URL`                                                  |

개발용 `.env`의 인증 secret과 `ROOT_PASSWORD`는 시드 실행을 위한 값이다. 운영 secret은 저장소에 커밋하지 않고 배포 환경의 secret 관리 경로에서 주입한다.
