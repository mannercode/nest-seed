# 환경 변수

이 저장소의 공식 개발 경로는 Dev Container이다. 로컬 직접 실행을 별도 지원 경로로 두지 않는다. 환경 변수도 Dev Container, Docker Compose, 테스트 실행기가 함께 쓰는 값을 기준으로 나뉘어 있다.

---

## 1. 파일 역할

| 파일                       | 읽는 곳                                                   | 역할                                                                                                    |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `infra/.env`               | Dev Container `runArgs`, `infra` compose                  | 개발 인프라 이미지 태그와 접속 값. MongoDB, Redis, MinIO, NATS, Temporal 서비스 이름과 포트를 정의한다. |
| `apps/api/.env`            | `apps/api/jest.global.js`, `deploy/compose.yml` 실행 경로 | API 런타임의 앱 설정. `PROJECT_ID`, HTTP, 인증, 로그 값을 둔다.                                         |
| `apps/api/api-docs/.env`   | `apps/api/api-docs/run.sh`                                | curl 기반 API 문서 실행 설정. 기본 `SERVER_URL`과 업로드 fixture 값을 둔다.                             |
| `apps/console/.env`        | Next.js console                                           | 관리 콘솔이 호출할 API 기준 URL을 둔다.                                                                 |
| `apps/user-app/.env`       | Next.js user-app                                          | 사용자 앱이 호출할 API 기준 URL을 둔다.                                                                 |

`.env` 파일은 역할별로 분리한다. API 설정 파일 하나에 모든 값을 몰아넣지 않고, 인프라가 소유한 값은 `infra/.env`에 둔다.

---

## 2. 값 흐름

Dev Container가 시작될 때 `.devcontainer/devcontainer.json`은 `infra/.env`를 컨테이너 환경으로 주입하고, `WORKSPACE_ROOT`, `COMPOSE_PROJECT_NAME`도 함께 세팅한다.

```
Dev Container
  -> infra/.env
  -> process.env 안의 MONGO_*, REDIS_*, S3_*, NATS_*, TEMPORAL_*
```

`postStartCommand`는 `infra/reset.sh`를 실행한다. 이 스크립트는 `infra`의 compose 파일들로 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal을 시작한다.

API는 Nest `ConfigModule`에서 `.env` 파일을 직접 읽지 않는다. `ignoreEnvFile: true`로 두고, 실행 경로가 준비한 `process.env`만 검증한다. 그래서 테스트와 배포 실행기는 각각 필요한 값을 먼저 환경에 올린다.

```
apps/api 통합 테스트
  -> apps/api/jest.global.js가 apps/api/.env 로드
  -> Dev Container 환경의 인프라 변수와 합쳐짐

deploy/test.sh
  -> apps/api/.env를 docker compose --env-file로 전달
  -> Dev Container 환경의 인프라 변수와 합쳐짐
  -> deploy/compose.yml이 API replica와 NGINX 실행

apps/api/api-docs/run.sh
  -> apps/api/api-docs/.env 로드
  -> SERVER_URL 대상에 curl 요청 실행
  -> _output/logs, _output/docs 산출
```

---

## 3. 포크할 때 확인할 값

새 프로젝트로 가져갈 때는 이름과 외부 자원 식별자를 먼저 바꾼다.

| 위치                       | 확인할 값                                           |
| -------------------------- | --------------------------------------------------- |
| `package.json`             | `name`                                              |
| `apps/api/.env`            | `PROJECT_ID`, `AUTH_ISSUER`, `AUTH_AUDIENCE`        |
| `infra/.env` | `MONGO_DATABASE`, `S3_BUCKET`, `TEMPORAL_NAMESPACE` |
| `deploy/compose.yml`       | API image 이름, 필요하면 replica 기본값             |
| `apps/console/.env`        | `API_BASE_URL`                                      |
| `apps/user-app/.env`       | `API_BASE_URL`                                      |

개발용 `.env`의 인증 secret은 시드 실행을 위한 값이다. 운영 secret은 저장소에 커밋하지 않고 배포 환경의 secret 관리 경로에서 주입한다.
