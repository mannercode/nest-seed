# 환경 변수

이 저장소의 공식 개발 경로는 Dev Container 하나다(이유는 [설계 결정 §5](decisions.md#5-개발-환경-dev-container-단일-경로)). 환경 변수도 Dev Container, Docker Compose, 테스트 실행기가 함께 쓰는 값을 기준으로 나뉘어 있다.

---

## 1. 파일 역할

| 파일                     | 읽는 곳                                                        | 역할                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.infra`             | Dev Container `runArgs`, `infra` compose, `deploy/compose.yml` | 개발 인프라 이미지 태그·digest와 접속 값. MongoDB, Redis, VersityGW, NATS, Restate 서비스 이름·포트와 dev 서버 포트(`API_PORT`, `CONSOLE_PORT`, `USER_APP_PORT`)를 정의한다. |
| `.env.api`               | Dev Container `runArgs`, `deploy/compose.yml` `env_file`       | API 런타임의 앱 설정. `NODE_ENV`(개발·테스트는 test, deploy가 production으로 덮어씀), `PROJECT_ID`, HTTP, 인증, 로그 값, `ROOT_PASSWORD`를 둔다.                             |
| `apps/api/api-docs/.env` | `apps/api/api-docs/run.sh`                                     | curl 기반 API 문서 실행 설정. `SERVER_URL`과 업로드 fixture 값을 둔다.                                                                                                       |
| `apps/console/.env`      | Next.js console                                                | 관리 콘솔이 호출할 API 기준 URL과 선택적인 trusted-proxy opt-in을 둔다.                                                                                                      |
| `apps/user-app/.env`     | Next.js user-app                                               | 사용자 앱이 호출할 API 기준 URL과 선택적인 trusted-proxy opt-in을 둔다.                                                                                                      |

`.env` 파일은 역할별로 분리한다. 인프라가 소유한 값은 `.env.infra`, API가 소유한 값은 `.env.api`에 둔다.

이미지 값의 태그는 사람이 버전을 읽을 수 있게 남기고, multi-architecture manifest digest가 실제 이미지 바이트를 고정한다. 이미지를 올릴 때는 태그와 digest를 함께 검증·갱신한다. 태그만 바꾸거나, 기존 digest를 다른 태그에 그대로 남기지 않는다. MongoDB만 `@testcontainers/mongodb`가 `MONGO_IMAGE`의 태그를 semver로 읽어 `mongosh` 사용 여부를 정하므로 `MONGO_IMAGE`와 `MONGO_IMAGE_DIGEST`를 분리한다. `infra/compose.mongo.yml`은 두 값을 `tag@digest`로 결합해 실제 인프라 이미지의 불변성은 그대로 유지한다.

Dependabot은 설정된 Dockerfile 디렉터리(`.devcontainer`, `apps/api`, `deploy`)와 Compose 디렉터리(`deploy`, `infra`)의 직접 참조를 매주 minor/patch 범위로 확인한다. 변수로 간접 참조하는 `.env.infra` 이미지는 자동 갱신 범위가 아니므로, 버전 갱신 때 사람이 태그와 multi-architecture digest를 함께 확인한다.

---

## 2. 값 흐름

Dev Container가 시작될 때 `.devcontainer/devcontainer.json`은 `.env.infra`와 `.env.api`를 `runArgs --env-file`로 컨테이너 환경에 주입하고, `containerEnv`로 `WORKSPACE_ROOT`, `COMPOSE_PROJECT_NAME`도 함께 세팅한다.

`--env-file`은 컨테이너 생성 시점에 평가된다. 두 파일의 값을 바꾸면 Dev Container를 Rebuild해야 반영된다. 또한 docker env-file은 셸이 아니라서 따옴표를 값에 그대로 포함시키고, `${...}`를 다른 변수의 값으로 치환하는 보간도 하지 않는다.

```
Dev Container
  -> .env.infra, .env.api
  -> process.env 안의 NODE_ENV, API_PORT, CONSOLE_PORT, USER_APP_PORT, HTTP_*, AUTH_*, ROOT_PASSWORD, MONGO_*, REDIS_*, S3_*, NATS_*, RESTATE_*
```

`postStartCommand`는 `infra/reset.sh`를 실행한다. 이 스크립트는 `infra`의 compose 파일들로 MongoDB Replica Set, Redis Cluster, VersityGW, NATS와 단일 Restate 서버를 시작한다. 이미지 태그와 `S3_BUCKET` 등은 컨테이너 환경에 이미 주입된 `.env.infra` 변수로 보간되고, 서비스 이름·포트는 compose 파일의 리터럴이다(그래서 3절의 포트 표가 필요하다).

API는 Nest `ConfigModule`에서 `.env` 파일을 직접 읽지 않는다. `ignoreEnvFile: true`로 두고, 실행 경로가 준비한 `process.env`만 검증한다. Dev Container가 두 `.env`를 미리 주입했으므로 모든 워크스페이스의 pnpm 프로세스는 그 환경을 그대로 상속한다.

```
apps/api 통합 테스트 (pnpm --filter './apps/api' test)
  -> .env.api + .env.infra 값이 Dev Container 환경에 이미 주입되어 있음
  -> jest는 추가 .env 로드 없이 그 process.env로 동작

pnpm run dev
  -> dev:api가 일반 HTTP(:3000)와 Restate HTTP/2 endpoint(:9080)를 시작
  -> dev:restate가 Admin API(:9070)에 개발 endpoint를 force 등록

deploy/verify.sh
  -> docker compose가 service의 env_file로 ../.env.infra, ../.env.api를 자동 inject
  -> deploy/compose.yml이 API replica와 NGINX 실행
  -> Restate Admin API에 NGINX HTTP/2 endpoint(:9080) 등록
  -> verify.sh는 run.sh에 SERVER_URL만 넘긴다 (ROOT_PASSWORD는 Dev Container가 주입한 환경에서 상속)

apps/api/api-docs/run.sh
  -> apps/api/api-docs/.env 로드
  -> SERVER_URL 대상에 curl 요청 실행
  -> _output/logs, _output/docs 산출
```

---

## 3. 포트 표 — 같이 바꿔야 할 곳

env 파일은 자기 보간이 안 되고 compose 서비스 정의와 스크립트에는 리터럴이 남으므로, 일부 값은 짝으로 맞춰야 한다. 아래 값을 바꿀 때는 짝을 함께 바꾼다.

| 값                             | 정의처                                                                             | 같이 바꿔야 할 곳                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 포트 3000                  | `.env.infra` `API_PORT`                                                            | `apps/console/.env`·`apps/user-app/.env`의 `API_BASE_URL`, `deploy/nginx.conf`의 upstream `api:3000`, `deploy/compose.yml` nginx `ports`의 호스트 포트, README (tunnel.sh·api predev·playwright·deploy healthcheck는 자동 추종) |
| console 포트 3100              | `.env.infra` `CONSOLE_PORT`                                                        | README (package.json 스크립트·tunnel.sh·playwright는 자동 추종)                                                                                                                                                                 |
| user-app 포트 3200             | `.env.infra` `USER_APP_PORT`                                                       | README (package.json 스크립트·tunnel.sh는 자동 추종)                                                                                                                                                                            |
| Mongo `mongo1~3:27016`         | `infra/compose.mongo.yml`                                                          | `.env.infra` `MONGO_URI`                                                                                                                                                                                                        |
| Redis `redis1~3:6379`          | `infra/compose.redis.yml`                                                          | `.env.infra` `REDIS_HOST1~3`/`REDIS_PORT1~3`                                                                                                                                                                                    |
| NATS `nats:4222`               | `infra/compose.nats.yml` 서비스 이름(4222는 NATS 기본 포트라 파일에 리터럴이 없다) | `.env.infra` `NATS_HOST`/`NATS_PORT`                                                                                                                                                                                            |
| Restate ingress `restate:8080` | `infra/restate/compose.restate.yml`                                                | `.env.infra` `RESTATE_INGRESS_URL`; API workflow client와 health indicator                                                                                                                                                      |
| Restate admin `restate:9070`   | `infra/restate/compose.restate.yml`                                                | `.env.infra` `RESTATE_ADMIN_URL`; 개발·deploy endpoint 등록 스크립트                                                                                                                                                            |
| Restate endpoint `:9080`       | `.env.infra` `RESTATE_SERVICE_PORT`                                                | API의 HTTP/2 listen, `apps/api/scripts/register-restate.js`, `deploy/nginx.conf`의 listen/upstream, `deploy/compose.yml` 등록 URI                                                                                               |
| VersityGW `s3:7070`            | `infra/compose.s3.yml`                                                             | `.env.infra` `S3_ENDPOINT` (Admin API와 WebUI는 비활성화)                                                                                                                                                                       |
| 배포 NGINX `http://nginx` (80) | `deploy/compose.yml`·`deploy/nginx.conf`                                           | `deploy/verify.sh`·`tests/api-race/runner.sh`·`tests/api-benchmark/runner.sh`의 `SERVER_URL`                                                                                                                                    |

---

## 4. 포크할 때 확인할 값

`nest-seed`나 `mannercode`라는 문자열을 저장소 전체에서 일괄 치환하지 않는다. 같은 문자열이어도 내부 식별자, 저자 소유 URL, 원 프로젝트의 운영 sentinel처럼 소유권과 의미가 다르다. 아래 대상만 새 프로젝트 정책에 맞춰 하나씩 바꾸고, 나머지 검색 결과는 용도를 확인한 뒤 유지하거나 수정한다.

| 대상                     | 확인할 값                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 패키지 식별자            | 루트 `package.json`의 `name`, 내부 워크스페이스의 `@mannercode/*` 이름·의존성·import·도구 alias. 새 내부 scope로 바꾸면 `pnpm-lock.yaml`도 함께 갱신한다.                           |
| Dev Container 식별자     | `.devcontainer/devcontainer.json`의 `${localEnv:USER:unknown}-${localWorkspaceFolderBasename}` network·Compose project 이름                                                         |
| API 런타임               | `.env.api`의 `PROJECT_ID`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `ROOT_PASSWORD`                                                                                                          |
| 인프라 런타임            | `.env.infra`의 `MONGO_DATABASE`, `S3_BUCKET`; Restate workflow 서비스 이름은 `.env.api`의 `PROJECT_ID`를 따른다.                                                                    |
| 배포 이미지              | `deploy/compose.yml`의 `nest-seed-api`와 deps 이미지 이름. replica 수는 배포 검증 정책이므로 줄이면 api-race·test-stability의 분산 전제가 깨진다([deploy 문서](../deploy.md) 참고). |
| 앱 세션·테스트 격리 이름 | 두 BFF의 cookie 접두사, Jest Mongo `appName`, API 문서 fixture 이메일처럼 프로젝트끼리 충돌하면 안 되는 내부 값                                                                     |
| 프런트엔드 환경          | `apps/console/.env`·`apps/user-app/.env`의 `API_BASE_URL`; 신뢰 edge 뒤에서만 `BFF_TRUST_PROXY_HEADERS=true`                                                                        |
| 저장소 링크·연락처       | README badge, 저자 블로그·귀속 표시는 새 소유권과 유지할 원 저작자 정보를 구분해 의도적으로 검토한다. URL이나 `mannercode.com`·이메일을 기계적으로 치환하지 않는다.                 |
| GitHub Settings          | ruleset, Actions/Dependabot 권한, `DOCKERHUB_*` secrets, 필요한 fork에만 `ENABLE_SCHEDULED_CI=true` — [GitHub 운영 설정](../github-setup.md)                                        |

정기 CI 조건의 `repository_id == '849585972'`는 원본 저장소만 변수 없이 schedule을 실행하게 하는 immutable sentinel이다. fork에서 자기 repository ID로 바꾸면 opt-in 안전장치를 우회하므로 치환하지 않는다.

패키지 scope를 바꿨다면 의존성과 lockfile을 갱신한 뒤 `pnpm run format`으로 import 정렬과 줄바꿈을 정리한다. 끝나면 devcontainer를 재생성(Rebuild Container)해 바뀐 `.env.*` 값이 `--env-file`로 다시 주입되게 한다. 컨테이너의 `process.env`는 생성 시점에 굳으므로, 재생성하지 않으면 개발 API와 등록 스크립트가 옛 `PROJECT_ID`·`RESTATE_*` 값으로 떠서 workflow 이름이나 endpoint URI가 어긋날 수 있다.

개발용 `.env`의 인증 secret과 `ROOT_PASSWORD`는 시드 실행을 위한 값이다. 운영 secret은 저장소에 커밋하지 않고 배포 환경의 secret 관리 경로에서 주입한다.

## 5. Quick Tunnel 공개 경계

`pnpm exec tunnel`은 서버를 인터넷에 공개하는 명시적 작업이므로 무플래그 실행을 거부한다. console·user-app을 공개하려면 다음 두 값을 **모두** 설정해야 한다.

```bash
TUNNEL_EXPOSE_APPS=true \
TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
pnpm exec tunnel
```

이 모드는 console·user-app Next.js 서버를 공개한다. 두 BFF는 catch-all proxy이며, 각 앱의 역할과 맞지 않는 login/logout·외부 refresh 같은 일부 auth endpoint만 차단한다. 따라서 백엔드 API surface의 대부분이 결국 인터넷에 노출되고, 최종 권한 경계는 백엔드 guard다. 두 번째 값은 이 사실을 인지했고 격리된 폐기성 환경에서만 쓴다는 명시적 승인이다.

direct API Quick Tunnel은 secret 값을 교체했더라도 **항상 거부**한다. tunnel 프로세스는 이미 실행 중인 API 프로세스가 어떤 secret을 쓰는지 증명할 수 없기 때문이다. `TUNNEL_EXPOSE_API=true`를 주면 opt-in이 아니라 그 위험한 요청을 명시적으로 거부하고 종료한다.

운영 secret·실제 데이터를 쓰는 환경을 quick tunnel에 연결하지 않는다. 사용 후 tunnel을 종료하고 외부에 노출한 임시 자격증명은 다시 회전한다. 공유 환경에는 Quick Tunnel 대신 신원 확인·접근 제어·장기 관리 도메인을 갖춘 엣지를 사용한다.
