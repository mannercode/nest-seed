# nest-seed

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)

NestJS API와 이에 연동되는 간단한 관리자 콘솔·사용자 앱을 한 저장소에 담은 모노레포 시드다. 모놀리스처럼 단순하게 시작하되 분산 환경에서 자주 마주치는 경계를 미리 잡아 두어, 필요할 때 특정 기능을 독립 서비스로 떼어내기 쉽다. 각 도구를 어디에 적용했고 왜 선택했는지는 [설계 결정](docs/decisions.md)에 정리해 두었다.

예제 도메인은 영화 예매다 — 영화·극장·상영·티켓을 다루는 도메인 위에 상영 등록 사가, 예매, 구매 같은 유스케이스를 올렸고, 코드의 패턴 이름이 모두 이 도메인 용어를 쓴다.

미리 잡아 둔 경계는 다음과 같다.

- **Redis 분산 락** — 컨테이너 여러 개가 같은 키를 동시에 처리하는 경쟁을 차단한다 (`application/showtime-creation`, `infrastructure/assets`의 cron)
- **NATS pub/sub** — 다른 컨테이너에 붙은 SSE 클라이언트에게 이벤트를 전달한다. 큐 그룹 수신도 지원한다 (`application/purchase`)
- **Temporal Saga** — 다단계 작업의 실행 기록·재시도·보상을 워크플로로 다룬다 (`application/showtime-creation`)
- **원자 조건부 전이** — 티켓 이중 판매를 락이 아니라 상태 조건부 갱신으로 막는다 (`core/tickets`)
- **soft delete × unique 인덱스** — 탈퇴한 이메일의 재가입을 복합 인덱스로 허용한다 (`core/users`)
- **presigned 업로드 + 체크섬** — 신고한 체크섬과 다른 본문은 스토리지가 업로드 자체를 거부한다 (`infrastructure/assets`)
- **검증 장치** — mock 대신 실제 인프라로 도는 테스트(커버리지 100% 게이트), 실행 가능한 API 문서, 분산 레이스 하네스, CI에서 레이스 시나리오 50회 반복

## 시작하기

개발은 Dev Container에서 진행한다. Docker와 VS Code가 필요하며, VS Code에는 Dev Containers 확장을 설치해야 한다. MongoDB Replica Set과 Redis Cluster 등 여러 인프라를 맞춰 띄워야 하므로, 로컬에서 직접 실행하는 절차는 따로 지원하지 않는다. 환경 변수 흐름과 부팅 과정은 [환경 변수](docs/environment.md)에 정리했다.

최소 사양은 CPU 4코어, RAM 16GB, 디스크 32GB다. 전체 테스트까지 안정적으로 돌리려면 RAM 32GB 이상을 권장한다.

처음 부팅 순서는 다음과 같다.

1. **새 프로젝트로 포크했다면** 저장소 전체에서 `nest-seed`를 새 프로젝트 이름으로, `mannercode`를 새 조직 이름으로 일괄 치환한다. 그 밖에 확인할 식별자는 [환경 변수 §4](docs/environment.md#4-포크할-때-확인할-값)에 있다.
2. VS Code에서 `Reopen in Container`를 실행한다. 컨테이너가 열리면 `postStartCommand`가 `bash infra/reset.sh`를 실행해 개발 인프라를 준비한다. 첫 부팅은 Dev Container 이미지 빌드, `npm install`, 인프라 이미지 다운로드 때문에 시간이 걸릴 수 있다. 인프라가 꼬이면 `bash infra/reset.sh`로 언제든 초기화한다.
3. `npm test`로 기본 테스트가 통과하는지 확인한다. 포크 직후 전체 회귀까지 확인하려면 `npm run atoz`를 실행한다.
4. `npm run dev`로 watch 모드를 띄운 뒤 `curl http://localhost:3000/health`로 API가 살아 있는지 본다.
5. 콘솔(3100)에 로그인한다. 부팅 직후엔 admin이 없으므로 root 자격증명의 Basic 인증으로 `POST /admins`를 호출해 첫 admin을 만든다 — 실행 가능한 시나리오는 `apps/api/api-docs/admins.spec`에 있다.
6. 콘솔에서 영화·극장·상영을 등록하고(상영 등록 진행 상황은 SSE로 표시된다), 사용자 앱(3200)에서 가입해 예매·구매까지 이어 본다.

> `.env.api`와 `.env.infra`는 커밋된 **개발용 기본값**이다(`ROOT_PASSWORD=DevPass1!` 포함). 포크하면 자기 값으로 바꾼다.

| 명령              | 용도                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`     | common·testing(libs), api, console, user-app watch 모드 동시 실행 (3000/3100/3200)           |
| `npm run dev:api` | API만 단독 watch 실행 (백엔드만 작업할 때. console/user-app은 선택적 클라이언트 앱)          |
| `npm test`        | 워크스페이스 Jest 테스트 실행 (libs 빌드 자동). 단일 spec 실행법은 [테스트](docs/testing.md) |
| `npm run lint`    | 워크스페이스 + 루트 타입 체크·ESLint·Prettier 검사                                           |
| `npm run atoz`    | 전체 흐름 검증 (lint·Jest·API 문서·console e2e까지, 포크 후 회귀 확인용)                     |

> `npm run atoz`가 내부 호출하는 `npm run clean`은 `git clean -fdX`로 .gitignore에 오른 파일을 모두 지운다 — 무시 목록에 둔 개인 파일도 지워지니 주의한다. 나머지 스크립트는 [package.json](package.json)을 본다.

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리(npm 패키지)
│   ├── temporal-sandbox/    @mannercode/temporal-sandbox — Temporal workflow 샌드박스 헬퍼
│   ├── common/              @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             @mannercode/testing — HttpTestClient, 픽스처 헬퍼
│
├── apps/
│   ├── api/                 ← NestJS API — SoLA 5계층 서비스 + 실행 가능한 api-docs/ (배포 시 기본 4개 컨테이너)
│   ├── console/             ← Next.js 관리 콘솔 — 최소 데모
│   └── user-app/            ← Next.js 사용자 앱 — 최소 데모
│
├── tests/
│   ├── api-race/            ← 배포된 API 스택을 대상으로 하는 분산 레이스 시나리오
│   ├── api-perf/            ← 배포된 API 스택을 대상으로 하는 성능 측정 도구
│   └── console-e2e/         ← Playwright 콘솔 e2e 테스트
│
├── infra/                   ← 개발 인프라 Compose (MongoDB·Redis·MinIO·NATS·Temporal)
├── deploy/                  ← Docker Compose, NGINX (앱 배포 진입점)
├── tools/                   ← 개발·테스트 보조 도구 (free-port, jest 헬퍼, quick tunnel)
├── docs/                    ← 아키텍처·컨벤션·테스트·환경·설계 결정 문서
├── .github/                 ← CI 워크플로 (atoz, test-stability)
│
└── .devcontainer/           ← Dev Container 정의
```

`apps/api/src/services` 아래 다섯 계층은 **SoLA(Service-oriented Layered Architecture)** 를 따른다 — 위 계층만 아래를 참조하고(gateway→view→application→core→infrastructure) 같은 계층끼리는 서로 직접 호출하지 않아 순환 참조를 막는다. 이 의존 방향은 ESLint로 강제한다. 자세한 내용은 [아키텍처](docs/architecture.md)를 본다.

## 사용 기술

처음 보는 도구가 있다면 "어디에 쓰나"의 위치부터 따라가면 된다.

| 도구                             | 어디에 쓰나                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| MongoDB (Replica Set) + Mongoose | 주 데이터베이스. 트랜잭션, soft delete — `libs/common/mongoose`                    |
| Redis (Cluster) + ioredis        | 캐시와 분산 락 — `libs/common/redis`, `libs/common/cache`                          |
| NATS                             | 컨테이너 사이 pub/sub — `libs/common/nats`                                         |
| Temporal                         | 사가 워크플로 — `application/showtime-creation/worker`                             |
| MinIO (S3 API)                   | presigned 파일 업로드·다운로드 — `libs/common/s3`, `infrastructure/assets`         |
| NestJS                           | API 서버. 가드·파이프를 Passport 없이 직접 구현 — `gateway/`                       |
| Next.js                          | console·user-app 최소 데모                                                         |
| @nestjs/jwt + bcrypt             | 역할별 토큰 서명, 비밀번호 해시 — `gateway/guards`                                 |
| class-validator                  | DTO 검증 — 각 서비스의 `dtos/`                                                     |
| npm workspaces                   | 모노레포 구성. libs를 내부 패키지로 공유                                           |
| Jest + Testcontainers            | 단위·통합 테스트. `libs/common`은 인프라를 직접 띄운다 — [테스트](docs/testing.md) |
| Playwright                       | 콘솔 브라우저 e2e — `tests/console-e2e`                                            |
| k6                               | 성능 측정 하네스 — `tests/api-perf`                                                |
| Docker Compose + NGINX           | 개발 인프라(`infra/`)와 다중 컨테이너 배포(`deploy/`)                              |
| GitHub Actions                   | atoz 회귀와 반복 안정성 검증 — `.github/workflows`                                 |
| cloudflared (`npx tunnel`)       | dev 서버 3종을 임시 공개 https 주소로 노출(OAuth 콜백·웹훅) — `tools/dev-tools`    |
| ESLint·Prettier·husky·commitlint | 계층 의존 강제(eslint-plugin-boundaries), 커밋 훅 — [컨벤션](docs/conventions.md)  |

## 도메인 둘러보기

각 서비스는 서로 다른 패턴을 하나씩 보여주도록 만들었다. 처음에는 다음 순서가 효율적이다.

1. `core/theaters` — 가장 단순한 도메인. 모델→리포지토리→서비스→컨트롤러→DTO의 기본 골격
2. `application/booking` — 여러 Core를 조합하는 유스케이스
3. `application/showtime-creation` — 사가 전체: 202 응답 → Temporal 워크플로 → NATS → SSE
4. 각 단계마다 같은 이름의 통합 테스트(`apps/api/src/__tests__/integration`)를 나란히 읽는다

| 서비스                                    | 보여주는 것                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `core/theaters`                           | 가장 단순한 CRUD. 새 도메인을 추가할 때 본보기로 복제할 기준                   |
| `core/movies`                             | 파일 업로드 연동, draft→publish 공개 상태, 상영이 참조 중이면 삭제 거부        |
| `core/users` · `admins`                   | soft delete × unique 인덱스, 로그인·토큰 회전, 탈퇴·비밀번호 변경 시 세션 폐기 |
| `core/showtimes` · `tickets`              | 사가가 만들어내는 자원. tickets는 원자 조건부 전이로 상태를 바꾼다             |
| `core/ticket-holding`                     | Redis Lua 스크립트 선점 — Cluster의 hash slot에 키를 모으는 설계               |
| `core/purchase-records` · `watch-records` | 사용자 기록 도메인. watch-records는 추천의 입력이 된다                         |
| `application/booking`                     | 예매 동선 조회와 좌석 선점, 요청 검증                                          |
| `application/purchase`                    | 구매 확정과 실패 보상, NATS 구독 2형(브로드캐스트·큐 그룹)                     |
| `application/showtime-creation`           | Temporal 사가, 202+SSE, 분산 락, 보상                                          |
| `application/recommendation`              | 관람 기록 기반 추천. 도메인 로직을 순수 모듈로 분리                            |
| `view/user-app/home`                      | 화면 전용 응답 조합 — View 계층                                                |
| `infrastructure/assets`                   | presigned 업로드와 체크섬 검증, 만료 업로드 정리 cron(분산 락)                 |
| `infrastructure/payments`                 | 외부 결제 연동 계층의 자리                                                     |

---

## 인가

JWT 기반으로 세 역할을 둔다. **root**는 `.env.api` 자격증명의 Basic 인증으로 admin 생성·삭제만 하고, **admin**(콘솔이 쓰는 역할)은 콘텐츠 관리와 임의 사용자 대상 작업을, **user**(사용자 앱)는 본인 자원만 다룬다. admin과 user 토큰은 서로 다른 secret으로 서명해 교차 사용이 안 된다. 본인 자원은 `/me` 경로로 식별자를 토큰 주체에 못박아 임의 ID로 남의 자원에 접근하는 경로(IDOR)가 구조적으로 생기지 않는다 — 설계 규칙은 [컨벤션 §4.5](docs/conventions.md#45-권한-경계-본인-자원은-me-임의-id는-admin)를 본다.

## API 레퍼런스

Swagger/OpenAPI는 의도적으로 두지 않았다(이유는 [설계 결정](docs/decisions.md)). 엔드포인트 카탈로그는 **실행 가능한 `apps/api/api-docs/*.spec`** 자체다. `bash deploy/verify.sh`(또는 `cd apps/api/api-docs && bash run.sh`)를 돌리면 브라우징 가능한 목록이 `_output/`에 생성된다 — `_output/`은 gitignore라 클론 직후엔 없으니 한 번 실행해야 한다. spec 작성 규약과 산출물 구성은 [테스트 §5](docs/testing.md#5-실행-가능한-api-문서)를 본다.

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리와 분산 협력 구조(락, NATS, Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, 가져오기, REST API 설계와 권한 경계, 데이터 비정규화, 커밋 규칙, fail-fast, 값의 위치
- [테스트](docs/testing.md) — 한글 메시지 규칙, 픽스처, 동적 가져오기, 실행 가능한 API 문서, 분산 레이스 테스트
- [환경 변수](docs/environment.md) — Dev Container, API, API 문서, console 환경 변수 흐름과 포크 체크리스트
- [설계 결정](docs/decisions.md) — 분산 도구·View 계층 등 핵심 설계 결정과 쓰지 않기로 한 대안
- [배포](deploy/README.md) — Docker Compose 다중 API 컨테이너 + NGINX, `x-replica-id` 응답 헤더

## 라이선스

[MIT](LICENSE).
