# nest-seed

NestJS API와 이에 연동되는 간단한 관리자 콘솔·사용자 앱을 한 저장소에 담은 모노레포 시드다. 처음에는 모놀리스처럼 단순하게 시작하되, 필요할 때 특정 기능을 독립 서비스로 쉽게 분리할 수 있도록 Redis, NATS, Temporal 같은 분산 도구를 기본으로 갖추고 있다.

단순한 CRUD API보다는, Redis 분산 락, NATS pub/sub, Temporal Saga처럼 분산 환경에서 자주 마주치는 몇 가지 경계를 미리 잡아 둔 NestJS 백엔드 시드다. 각 도구를 어디에 적용했고 왜 선택했는지는 [설계 결정](docs/decisions.md)에 정리해 두었다.

## 시작하기

개발은 Dev Container에서 진행한다. Docker와 VS Code가 필요하며, VS Code에는 Dev Containers 확장을 설치해야 한다. MongoDB Replica Set과 Redis Cluster 등 여러 인프라를 맞춰 띄워야 하므로, 로컬에서 직접 실행하는 절차는 따로 지원하지 않는다. 환경 변수 흐름과 부팅 과정은 [환경 변수](docs/environment.md)에 정리했다.

최소 사양은 CPU 4코어, RAM 16GB, 디스크 32GB다. 전체 테스트까지 안정적으로 돌리려면 RAM 32GB 이상을 권장한다.

처음 부팅 순서는 다음과 같다.

1. **새 프로젝트로 포크했다면** 저장소 전체에서 `nest-seed`를 검색해 새 프로젝트 이름으로 모두 바꾸고, `mannercode`를 검색해 새 조직 이름으로 모두 바꾼다.
2. VS Code에서 `Reopen in Container`를 실행한다. 컨테이너가 열리면 `postStartCommand`가 `bash infra/reset.sh`를 실행해 개발 인프라를 준비한다. 첫 부팅은 Dev Container 이미지 빌드, `npm install`, 인프라 이미지 다운로드 때문에 시간이 걸릴 수 있다.
3. `npm test`로 기본 테스트가 통과하는지 확인한다. 포크 직후 전체 회귀까지 확인하려면 `npm run atoz`를 실행한다.
4. `npm run dev`로 watch 모드를 띄운 뒤 `curl http://localhost:3000/health`로 API가 살아 있는지 본다.

> `.env.api`와 `.env.infra`는 커밋된 **개발용 기본값**이다(`ROOT_PASSWORD=DevPass1!` 포함). 포크하면 자기 값으로 바꾼다 — 전체 흐름은 [환경 변수](docs/environment.md)를 본다.

| 명령                    | 용도                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`           | common·testing(libs), api, console, user-app watch 모드 동시 실행 (3000/3100/3200)           |
| `npm run dev:api`       | API만 단독 watch 실행 (백엔드만 작업할 때. console/user-app은 선택적 클라이언트 앱)          |
| `npx tunnel`            | 세 서비스를 공개 https 주소로 노출하는 quick tunnel (실행 중에만 유지, Ctrl+C로 종료)        |
| `npm test`              | 워크스페이스 Jest 테스트 실행 (libs 빌드 자동). 단일 spec 실행법은 [테스트](docs/testing.md) |
| `npm run lint`          | 워크스페이스 + 루트 타입 체크·ESLint·Prettier 검사                                           |
| `npm run format`        | ESLint `--fix` + Prettier로 코드 정리                                                        |
| `npm run build`         | 전체 워크스페이스 빌드                                                                       |
| `bash deploy/verify.sh` | Compose 스택을 띄우고 curl 기반 API 문서 검증                                                |
| `npm run atoz`          | 전체 흐름 검증 (lint·Jest·API 문서·console e2e까지, 포크 후 회귀 확인용)                     |

> `npm run clean`은 `git clean -fdX`로 .gitignore에 오른 파일(빌드 산출물, node_modules, `.env*.local` 등)을 모두 지우고 인프라를 초기화한다(`npm run atoz`가 내부에서 호출). 무시 목록에 둔 개인 파일도 지워지니 주의한다.

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리(npm 패키지)
│   ├── temporal-sandbox/    @mannercode/temporal-sandbox — Temporal workflow 샌드박스 헬퍼
│   ├── common/              @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             @mannercode/testing — HttpTestClient, 픽스처 헬퍼
│
├── apps/api/                ← NestJS API (배포 시 기본 4개 컨테이너)
│   ├── src/
│   │   ├── services/            서비스 계층
│   │   │   ├── gateway/             HTTP 진입점, 가드(root/admin/user), 파이프
│   │   │   ├── application/         여러 도메인을 조합하는 작업(Temporal 워크플로 + 액티비티)
│   │   │   ├── view/                화면 요구에 맞게 하위 계층(core·application)을 조합하는 소비자(예: user-app/home)
│   │   │   ├── core/                도메인 모델, 리포지토리
│   │   │   └── infrastructure/      외부 서비스 연동 (결제, 파일)
│   │   ├── config/              환경 변수, 외부 자원 설정
│   │   ├── modules/             NestJS 모듈 연결 (AppConfig, Global, Health, *-setup)
│   │   └── bootstrap.ts         애플리케이션 부팅 진입점
│   └── api-docs/                실행 가능한 API 문서 (curl 기반)
│
├── apps/console/            ← Next.js 관리 콘솔 (로컬 기본 3100 포트)
├── apps/user-app/           ← Next.js 사용자 웹 앱 (로컬 기본 3200 포트)
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
└── .devcontainer/           ← Dev Container 정의 (인프라는 infra/를 참조)
```

`services` 아래 다섯 계층은 **SoLA(Service-oriented Layered Architecture)** 를 따른다 — 위 계층만 아래를 참조하고(gateway→view→application→core→infrastructure) 같은 계층끼리는 서로 직접 호출하지 않아 순환 참조를 막는다. 이 의존 방향은 ESLint로 강제한다. 자세한 내용은 [아키텍처](docs/architecture.md)를 본다.

---

## 인가

JWT 기반으로 세 역할을 둔다. admin과 user 토큰은 서로 다른 secret으로 서명해, user 토큰으로 admin API에 접근할 수 없다.

- **root** — `.env`의 자격증명으로 Basic 인증. admin 생성·삭제(lifecycle)만 한다.
- **admin** — root가 만든 운영자. 콘텐츠(영화·극장·상영) 관리와 임의 사용자 대상 작업(`GET /users` 목록, `GET·PATCH·DELETE /users/:id`)을 한다. 콘솔(`apps/console`)이 이 역할로 동작한다.
- **user** — 일반 사용자. 가입(`POST /users`)·로그인하고, 본인 정보 조회·수정·탈퇴(`GET·PATCH·DELETE /users/me`), 본인 구매 기록 조회(`GET /users/me/purchases`), 결제(`POST /purchases`)를 한다. 사용자 앱(`apps/user-app`)이 이 역할이다.

본인 자원은 경로에 식별자가 없는 **`/me` 계열**로 다룬다. 식별자를 인증 토큰의 주체(`req.user.sub`)로 못박으므로, 로그인 사용자가 임의 ID를 넣어 남의 자원에 접근하는 경로(IDOR) 자체가 생기지 않는다. 임의 ID를 다루는 작업은 모두 admin이다 — `/me`(본인)와 `/:id`(운영자)로 권한 경계가 갈린다. 결제도 같은 원칙이라 `POST /purchases`는 본문이 아니라 토큰 주체로 결제자를 정한다.

한 컨트롤러에 **서로 다른 역할의 핸들러가 섞이면**(`users`·`admins`처럼 `/me`는 본인, `/:id`는 admin) 가드는 클래스가 아니라 **핸들러마다** 붙인다. 클래스 가드를 두면 메서드 가드가 그것에 합쳐져(둘 다 통과해야 함) admin 전용으로 만들려던 핸들러가 user 가드에도 걸리기 때문이다. 반대로 모든 핸들러가 같은 역할인 컨트롤러(예: admin 전용 `showtime-creation`)는 클래스 레벨 가드를 쓴다.

### 최초 admin 만들기

컨테이너를 띄운 직후엔 admin이 없다. root 자격증명으로 첫 admin을 만들고 로그인하는 순서는 다음과 같다(실행 가능한 시나리오는 `apps/api/api-docs/admins.spec`에 있다).

1. root가 Basic 인증으로 admin 생성 — `POST /admins`, `Authorization: Basic <base64(root:$ROOT_PASSWORD)>`
2. 만든 admin으로 로그인 — `POST /admins/login`으로 토큰 발급
3. 콘솔(`apps/console`, 3100)의 `/login`에서 같은 자격증명으로 접속

## API 레퍼런스

Swagger/OpenAPI는 의도적으로 두지 않았다(이유는 [설계 결정](docs/decisions.md)). 엔드포인트 카탈로그는 **실행 가능한 `apps/api/api-docs/*.spec`** 자체다. `bash deploy/verify.sh`(또는 `cd apps/api/api-docs && bash run.sh`)를 돌리면 브라우징 가능한 목록이 `_output/`에 생성된다 — `_output/`은 gitignore라 클론 직후엔 없으니 한 번 실행해야 한다.

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리와 분산 협력 구조(락, NATS, Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, 가져오기, REST API 설계, 데이터 비정규화, 커밋 규칙
- [테스트](docs/testing.md) — 한글 메시지 규칙, 픽스처, 동적 가져오기, 실행 가능한 API 문서, 분산 레이스 테스트
- [환경 변수](docs/environment.md) — Dev Container, API, API 문서, console 환경 변수 흐름과 포크 체크리스트
- [설계 결정](docs/decisions.md) — 분산 도구·View 계층 등 핵심 설계 결정과 쓰지 않기로 한 대안
- [배포](deploy/README.md) — Docker Compose 다중 API 컨테이너 + NGINX, `x-replica-id` 응답 헤더

## 기여

커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org)를 따른다 — commitlint(`commit-msg` 훅)가 강제하므로 형식이 어긋나면 커밋이 거부된다. `pre-commit` 훅은 staged 파일에 ESLint `--fix`와 Prettier를 자동 적용한다(lint-staged). 규칙 세부는 [컨벤션 §7](docs/conventions.md)을 본다.

## 라이선스

[MIT](LICENSE).
