# 환경 변수

환경 값은 실행 경로가 주입하고 API는 검증해서 소비한다. 이 문서는 파일별 소유권, 주입 시점과 함께 바꿔야 하는 경계를 설명한다. 정확한 키·개발 값은 env 파일, 필수 여부와 형식은 검증 스키마가 소유한다.

## 1. 값의 소유권

| 위치                                               | 읽는 곳과 소유하는 값                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.env.infra`                                       | Dev Container·infra·테스트 실행기가 사용하는 인프라 접속·이미지·개발 포트·고정 admin |
| `.env.api`                                         | API 런타임의 인증·HTTP·로그·업무 설정                                                |
| `apps/api/api-docs/.env`                           | curl 문서 실행기의 대상 서버와 파일 fixture                                          |
| `apps/console/.env`, `apps/user-app/.env`          | 각 Next.js BFF의 API 대상과 proxy 신뢰 opt-in                                        |
| `.devcontainer/devcontainer.json`의 `containerEnv` | workspace 절대경로, Compose project와 공유 Docker network                            |

인프라 값은 `.env.infra`, API 정책은 `.env.api`에 둔다. env로 받기로 한 값에는 조용한 기본값을 두지 않고 실행 환경에 명시한다. 배포 중 바꾸지 않는 상수까지 env로 옮기지는 않는다([개발 규칙](conventions.md#7-런타임-설정은-명시한다)).

`NODE_ENV`는 공용 env 파일에 두지 않는다. API의 개발 entry point와 테스트 스택이 각각 실행 모드를 정하고, Next.js·Vitest도 자기 실행 모드를 사용한다.

## 2. 주입 시점과 모듈 초기화

Dev Container는 생성할 때 `.env.api`와 `.env.infra`를 `process.env`로 주입한다. pnpm과 앱·테스트는 이 환경을 상속한다. API의 `ConfigModule`은 `ignoreEnvFile: true`이며, env 파일을 추가로 찾아 읽지 않는다.

```text
Dev Container 생성
  .env.infra + .env.api + containerEnv
                 ↓
              process.env
                 ↓
  AppConfigService 검증 → 연결 설정·도메인 정책
```

env 파일을 고친 뒤 앱만 재시작하거나 `docker restart`를 실행하면 컨테이너의 기존 환경은 남는다. Dev Container를 재생성해야 한다. 자세한 개발 환경 제약은 [devcontainer](../devcontainer.md#1-환경-변수는-재생성해야-반영된다)를 따른다.

`export const value = process.env.KEY`는 파일을 import한 시점의 값으로 고정된다. 이후 ConfigModule을 초기화하거나 테스트에서 환경을 바꿔도 그 상수는 다시 계산되지 않는다. 앱별·테스트별 설정은 제공자 생성 시점에 주입받는다. `common`은 특정 앱의 env 파일 위치를 찾아가는 역할을 맡지 않는다.

### Docker env-file은 shell이 아니다

Dev Container의 `--env-file`은 따옴표를 제거하거나 다른 변수를 보간하지 않는다.

```dotenv
API_HOST=api
API_URL=http://${API_HOST}:3000
PASSWORD="secret"
```

위 값에서 `API_URL`에는 `${API_HOST}`가, `PASSWORD`에는 따옴표가 그대로 남는다. 필요한 최종 값을 쓴다. 같은 파일을 shell 실행기나 Compose도 읽을 수 있으므로 shell 구문·변수 참조에 기대어 의미를 달리 만들지 않는다.

Compose의 `${...}`는 YAML을 해석할 때의 보간이고, 서비스의 `env_file`은 생성할 컨테이너 안에 넣는 환경이다. Compose 실행기가 값을 안다고 모든 서비스 컨테이너에 자동으로 들어가는 것은 아니다.

## 3. 실행 경로별 흐름

| 실행 경로                              | 환경과 준비                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run dev`                         | Dev Container 환경을 상속하고 API와 두 frontend를 시작함. `dev:restate`가 개발 HTTP/2 endpoint를 등록                      |
| API 통합 테스트                        | 추가 env 파일 없이 상속된 환경을 사용함. setup이 앱 import 전에 worker 환경을, `beforeEach`가 테스트별 `PROJECT_ID`를 설정 |
| common 테스트                          | Testcontainers로 만든 자원의 접속 값을 테스트 환경에 연결                                                                  |
| `pnpm run api-docs`·`race`·`benchmark` | 실행기가 `.env.infra`를 읽고 API Compose에 두 env 파일을 주입. 고정 admin 로그인과 NGINX Restate endpoint 등록 후 검증     |
| API 문서 직접 실행                     | `apps/api/api-docs/.env`의 대상에 요청. 스택 실행기가 전달한 `SERVER_URL`로 검증 대상을 지정할 수 있음                     |
| `pnpm run e2e`                         | web 실행기가 Compose 보간 값을 준비. API만 두 env 파일을 받고 BFF에는 API URL·port·테스트용 cookie/proxy 설정을 전달       |

API 테스트의 `PROJECT_ID`는 Redis key, NATS subject와 workflow 이름의 격리에도 사용된다. Nest 데코레이터에서 최초 값을 캡처하지 않고 제공자를 만들 때 같은 설정에서 파생해야 한다. DB·bucket은 worker 범위이며 같은 API Vitest 명령의 동시 실행은 지원하지 않는다([apps의 자원 수명](../apps.md#41-테스트-자원은-소유자가-드러나야-한다)).

개발 endpoint는 Dev Container 주소를, 다중 복제본 검증은 NGINX 주소를 Restate에 등록한다. `PROJECT_ID`나 endpoint 관련 값을 바꾸면 앱과 등록 스크립트가 같은 새 환경을 사용해야 한다. 검증 스택의 등록은 [tests](../tests.md#5-restate-endpoint-등록), 운영 revision 전환은 [설계 결정](decisions.md#endpoint와-revision-전환)을 따른다.

## 4. 같이 바꿔야 하는 주소와 포트

env를 바꿔도 Compose·NGINX·URL의 리터럴이 자동으로 따라 바뀌지는 않는다. 값을 변경할 때 다음 양쪽을 확인한다.

| 바꿀 값                   | 함께 확인할 곳                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| API HTTP port             | `.env.infra`의 `API_PORT`, BFF `.env`의 `API_BASE_URL`, `tests/api/nginx.conf`의 upstream        |
| API 문서를 실행할 주소    | `apps/api/api-docs/.env`와 대상 스택의 NGINX host port. API 내부 port와 host publish port는 별개 |
| console·user-app port     | `.env.infra`, Next.js 실행 명령·web Compose·tunnel의 참조와 README 접속 예시                     |
| MongoDB 주소·port         | `infra/compose.mongo.yml`의 Replica Set 멤버 주소·healthcheck와 `MONGO_URI`                      |
| Redis 주소·port           | `infra/compose.redis.yml`의 announce·cluster setup 주소와 `REDIS_HOST*`·`REDIS_PORT*`            |
| S3 주소·region            | `infra/compose.s3.yml`의 gateway·bucket setup과 `S3_ENDPOINT`·`S3_REGION`                        |
| NATS 주소·port            | `infra/compose.nats.yml` 서비스와 `NATS_HOST`·`NATS_PORT`                                        |
| Restate ingress·admin     | `infra/compose.restate.yml`과 `RESTATE_INGRESS_URL`·`RESTATE_ADMIN_URL`, 등록 스크립트           |
| API의 Restate HTTP/2 port | `RESTATE_SERVICE_PORT`, `tests/api/nginx.conf`와 `tests/api/compose.yml`의 등록 URI              |

MongoDB와 Redis는 최초 접속 뒤 서버가 알려 준 멤버 주소로 다시 연결한다. 첫 주소만 바꾸거나 host port만 열어서는 topology discovery가 성립하지 않을 수 있다. 현재 개발 경로는 모두 같은 Docker network의 service DNS를 쓴다.

## 5. 포크할 때 확인할 값

`nest-seed`·`mannercode`를 저장소 전체에서 일괄 치환하지 않는다. 내부 프로젝트 식별자, 저자 URL, 원 저장소의 CI 대상은 같은 문자열이어도 의미가 다르다.

| 대상              | 확인할 경계                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| 패키지 이름·scope | workspace manifest, 의존성·import·도구 alias와 lockfile을 함께 변경                  |
| 프로젝트·network  | workspace basename과 `containerEnv`; 같은 호스트의 clone끼리 자원이 겹치지 않게 구분 |
| API identity      | `PROJECT_ID`, 인증 issuer·audience·역할별 secret. NATS·Redis·workflow 이름에도 영향  |
| 개발 데이터       | `MONGO_DATABASE`, `S3_BUCKET`, 고정 admin fixture와 API 문서 fixture                 |
| frontend          | BFF cookie 이름·API 대상, 운영 edge에 맞는 proxy 신뢰 설정                           |
| 테스트 이미지     | `tests/api/compose.yml`의 이미지 이름과 호출하는 실행기                              |
| 저장소 URL·CI     | README badge, workflow·자동 갱신 설정의 소유 저장소 참조                             |

키와 이미지 값의 최종 정의는 현재 env·Dockerfile·Compose에 있다. 태그와 digest를 함께 고정한 이미지 참조는 둘을 함께 확인해 갱신한다. env의 간접 참조 이미지가 Dockerfile 자동 갱신에 포함된다고 가정하지 않는다.

변경 뒤 의존성·lockfile을 맞추고 Dev Container를 재생성해 새 환경을 주입한다. 커밋된 env는 개발·검증용이며 운영 secret은 저장소 밖에서 주입한다. Quick Tunnel의 실제 공개 범위는 [tools](../tools.md#2-dev-tools--명시적으로-실행하는-개발-도구)를 본다.
