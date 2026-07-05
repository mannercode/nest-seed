# nest-seed

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)

이 시드는 학습을 염두에 뒀지만, 실제 프로덕션의 베이스이기도 하다 — 저자가 이걸로 실무 프로젝트를 진행한다. NestJS 백엔드(`apps/api`)가 본체이고, 모놀리스로 설계되어 있지만 필요할 때 특정 기능을 독립 서비스로 떼어내기 쉽도록 모듈 경계를 미리 그어 두었다.

경계의 실체는 두 가지다. SoLA 5계층은 같은 계층의 모듈끼리 직접 부르지 않게 하고, 컨트롤러는 NestJS 관례처럼 각 모듈 안에 두지 않고 Gateway 계층으로 분리한다. 그래서 모듈은 이웃 모듈과 HTTP 어느 쪽에도 묶이지 않는다 — 계층 규칙은 [apps 문서](docs/apps.md#sola-5계층)가 설명한다.

서비스를 떼어낼 때 DB부터 풀지 않아도 되도록, 외래 키·조인처럼 경계를 넘는 DB 관계를 두지 않고 서비스가 ID로 관계를 관리한다. 관계형 DB의 핵심 가치가 쓰일 일이 없으니 MongoDB를 쓰고, 도메인 사이 정합성은 DB 제약이 아니라 서비스가 책임진다.

관리자 콘솔과 사용자 앱은 모노레포에 프런트엔드를 얹는 최소 데모다.

예제 도메인은 영화 예매다. 누구나 아는 도메인인 데다 좌석이라는 경합 자원이 있고, 코드는 모놀리스지만 배포는 기본 4개 컨테이너라서 이중 판매·부분 실패·진행 상황 전달 같은 분산 문제가 자연스럽게 발생한다. 영화·극장·상영·티켓 같은 모델 위에 상영 등록·예매·구매 같은 유스케이스를 올렸고, 코드의 패턴 이름이 모두 이 도메인 용어를 쓴다.

세 문제는 각각 이렇게 푼다.

- **이중 판매** — 락이 아니라 원자 조건부 전이(상태를 필터에 박은 갱신)로 막는다 (`core/tickets`)
- **부분 실패** — Temporal 사가가 실행 기록·재시도·보상(앞 단계 되돌리기)을 맡는다 (`application/showtime-creation`)
- **진행 상황 전달** — NATS pub/sub가 다른 컨테이너에 붙은 SSE 클라이언트까지 이벤트를 나른다 (`application/showtime-creation`)

이 해법들이 실제로 동작하는지는 mock 없는 실제 인프라 테스트(커버리지 100% 게이트)와 분산 레이스 하네스, CI 반복이 검증한다. 전체 패턴 목록은 [도메인 둘러보기](#도메인-둘러보기)에, 도구 선택의 이유는 [설계 결정](docs/reference/decisions.md)에 있다.

## 시작하기

개발은 Dev Container에서 진행한다. Docker와 VS Code가 필요하며, VS Code에는 Dev Containers 확장을 설치해야 한다. MongoDB Replica Set과 Redis Cluster 등 여러 인프라를 맞춰 띄워야 하므로, 로컬에서 직접 실행하는 절차는 따로 지원하지 않는다. 환경 변수 흐름과 부팅 과정은 [환경 변수](docs/reference/environment.md)에 정리했다.

최소 사양은 CPU 4코어, RAM 16GB, 디스크 32GB다. 전체 테스트까지 안정적으로 돌리려면 RAM 32GB 이상을 권장한다.

처음 부팅 순서는 다음과 같다.

1. **새 프로젝트로 포크했다면** 저장소 전체에서 `nest-seed`를 새 프로젝트 이름으로, `mannercode`를 새 조직 이름으로 일괄 치환한다. 치환 후 정리 절차와 그 밖에 확인할 식별자는 [환경 변수 §4](docs/reference/environment.md#4-포크할-때-확인할-값)를 따른다.
2. VS Code에서 `Reopen in Container`를 실행한다. 컨테이너가 열리면 `postStartCommand`가 `bash infra/reset.sh`를 실행해 개발 인프라를 준비한다. 첫 부팅은 Dev Container 이미지 빌드, `npm install`, 인프라 이미지 다운로드 때문에 시간이 걸릴 수 있다. 인프라가 꼬이면 `bash infra/reset.sh`로 언제든 초기화한다.
3. `npm test`로 기본 테스트가 통과하는지 확인한다. 포크 직후 전체 회귀까지 확인하려면 `npm run atoz`를 실행한다.
4. `npm run dev`로 watch 모드를 띄운 뒤 `curl http://localhost:3000/health`로 API가 살아 있는지 본다.
5. 콘솔(3100)에 로그인한다. 부팅 직후엔 admin이 없으므로 root 계정(사용자명은 `root` 고정, 비밀번호는 `.env.api`의 `ROOT_PASSWORD` — devcontainer 터미널에 주입되어 있다)의 Basic 인증으로 첫 admin을 만든다.

    ```bash
    curl -u "root:${ROOT_PASSWORD}" -H 'Content-Type: application/json' \
        -d '{"email":"admin@example.com","password":"admin1234!","name":"Admin"}' \
        http://localhost:3000/admins
    ```

    admin API 전체(로그인·재발급·삭제까지)는 [admins.spec](apps/api/api-docs/admins.spec)이 보여준다.

6. 콘솔에서 영화·극장을 등록한다. 상영 등록(202+SSE)·예매·구매는 UI 데모가 아니라 실행 가능한 API 문서가 보여준다 — `bash apps/api/api-docs/run.sh showtime-creation.spec`으로 상영까지 만들면, 사용자 앱(3200)에 가입해 홈에서 상영 중 영화를 확인할 수 있다.

> `.env.api`와 `.env.infra`는 커밋된 **개발용 기본값**이다(`ROOT_PASSWORD=DevPass1!` 포함). 포크하면 자기 값으로 바꾼다.

## 개발 명령

개발은 테스트 주도다 — 테스트가 필요한 환경(인프라·해당 모듈)을 코드로 띄우므로, 서비스를 나눠 가도 한 모듈을 작업하는 루프가 그대로다(왜 이게 설계와 맞는지는 [apps 문서](docs/apps.md#테스트)). 작업 루프는 주로 단일 spec 실행이고(아래 [테스트](#테스트)), `npm run dev`로 앱을 직접 띄우는 건 서비스가 늘수록 기동 부담이 커지니 실제 앱이 필요할 때만 쓴다.

| 명령              | 용도                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `npm test`        | 단위·통합 테스트 (커버리지 100% 게이트)                                         |
| `npm run lint`    | 정적 검사 전부 — 타입 체크·ESLint·Prettier·shellcheck·문서 링크                 |
| `npm run dev`     | 실제 앱을 띄워 볼 때 — api(3000)·console(3100)·user-app(3200) + libs watch      |
| `npm run dev:api` | API만 띄울 때                                                                   |
| `npm run atoz`    | 포크 직후/배포 전 전체 검증 — 깨끗한 상태에서 lint·테스트·API 문서·e2e·배포까지 |

> `npm run atoz`가 내부 호출하는 `npm run clean`은 `git clean -fdX`로 .gitignore에 오른 파일을 모두 지운다 — 무시 목록에 둔 개인 파일도 지워지니 주의한다. 나머지 스크립트는 [package.json](package.json)을 본다.

## 테스트

```bash
npm test -w apps/api -- users.spec --coverage=false   # 단일 spec만 실행 (게이트 끔)
npm run e2e                                           # 콘솔 브라우저 e2e (Playwright)
bash tests/api-race/runner.sh <scenario>              # 분산 레이스 — 다중 복제본 배포 스택을 직접 띄운다
bash tests/api-perf/runner.sh                         # 성능 측정 — 스택 기동·시드·측정·정리까지 한 번에
```

테스트 체계와 작성 규칙은 [apps 문서](docs/apps.md#테스트)가, 분산 레이스·성능 측정의 실행과 해석은 [tests 문서](docs/tests.md)가 설명한다.

## 배포

```bash
bash deploy/verify.sh   # API 4-replica + NGINX 스택을 새로 띄워 검증하고 내린다
```

`verify.sh`는 의존성 설치 레이어를 담은 deps 이미지 준비부터 실행 가능한 API 문서 검증까지 배포 전체 흐름을 한 번에 돈다. 구성 파일과 배포 정책(복제본 수·포트), `x-replica-id` 응답 헤더는 [deploy 문서](docs/deploy.md)에 있다.

## API 레퍼런스

Swagger/OpenAPI는 의도적으로 두지 않았다(이유는 [설계 결정](docs/reference/decisions.md)). 엔드포인트 카탈로그는 **실행 가능한 `apps/api/api-docs/*.spec`** 자체다. dev 서버가 떠 있으면 `bash apps/api/api-docs/run.sh`로 실행하고, 아니면 위 [배포](#배포)의 `verify.sh`가 실행까지 겸한다. 어느 쪽이든 브라우징 가능한 목록이 `apps/api/api-docs/_output/`에 생성된다 — gitignore라 클론 직후엔 없으니 한 번 실행해야 한다. spec 작성 규약과 산출물 구성은 [apps 문서](docs/apps.md#실행-가능한-api-문서)를 본다.

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리(npm 패키지)
│   ├── temporal-sandbox/    ← @mannercode/temporal-sandbox — Temporal workflow 샌드박스 헬퍼
│   ├── common/              ← @mannercode/common — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             ← @mannercode/testing — HttpTestClient, 픽스처 헬퍼
│
├── apps/
│   ├── api/                 ← NestJS API — 5계층 서비스 + 실행 가능한 api-docs/
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
├── docs/                    ← 폴더 문서와 횡단 주제 참고 문서(reference/)
├── .github/                 ← CI 워크플로 (atoz, test-stability)
│
└── .devcontainer/           ← Dev Container 정의
```

각 폴더가 무엇이고 왜 이렇게 나뉘었는지는 [문서](#문서) 절의 폴더 문서가 안내한다. `apps/api/src/services`의 다섯 계층(SoLA)과 분산 협력 구조는 [apps 문서](docs/apps.md)가 설명한다.

## 사용 기술

처음 보는 도구가 있다면 "어디에 쓰나" 열의 코드 경로나 문서부터 따라가면 된다.

| 도구                             | 어디에 쓰나                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB (Replica Set) + Mongoose | 주 데이터베이스. 트랜잭션, soft delete — `libs/common/mongoose`                                                                    |
| Redis (Cluster) + ioredis        | 캐시와 분산 락 — `libs/common/redis`, `libs/common/cache`                                                                          |
| NATS                             | 컨테이너 사이 pub/sub — `libs/common/nats`                                                                                         |
| Temporal                         | 사가 워크플로 — `application/showtime-creation/worker`                                                                             |
| MinIO (S3 API)                   | presigned 파일 업로드·다운로드 — `libs/common/s3`, `infrastructure/assets`                                                         |
| NestJS                           | API 서버. 가드·파이프를 Passport 없이 직접 구현 — `gateway/`                                                                       |
| Next.js                          | console·user-app 최소 데모                                                                                                         |
| @nestjs/jwt + bcrypt             | 역할별 토큰 서명, 비밀번호 해시 — `gateway/guards`                                                                                 |
| class-validator                  | DTO 검증 — 각 서비스의 `dtos/`                                                                                                     |
| npm workspaces                   | 모노레포 구성. libs를 내부 패키지로 공유                                                                                           |
| Jest + Testcontainers            | 단위·통합 테스트. `libs/common`은 인프라를 직접 띄운다 — [apps 문서](docs/apps.md#테스트)                                          |
| Playwright                       | 콘솔 브라우저 e2e — `tests/console-e2e`                                                                                            |
| k6                               | 성능 측정 하네스 — `tests/api-perf`                                                                                                |
| Docker Compose + NGINX           | 개발 인프라(`infra/`)와 다중 컨테이너 배포(`deploy/`)                                                                              |
| GitHub Actions                   | atoz 회귀와 반복 안정성 검증 — `.github/workflows`                                                                                 |
| cloudflared (`npx tunnel`)       | dev 서버 3종을 임시 공개 https 주소로 노출(OAuth 콜백·웹훅) — `tools/dev-tools`                                                    |
| ESLint·Prettier·husky·commitlint | 계층 의존 강제(eslint-plugin-boundaries) — [apps 문서](docs/apps.md#sola-5계층), 커밋 훅 — [컨벤션](docs/reference/conventions.md) |

## 도메인 둘러보기

각 서비스는 서로 다른 패턴을 하나씩 보여주도록 만들었다. 처음에는 다음 순서가 효율적이다.

1. `core/theaters` — 가장 단순한 도메인. 모델→리포지토리→서비스→컨트롤러→DTO의 기본 골격
2. `application/booking` — 여러 Core를 조합하는 유스케이스
3. `application/showtime-creation` — 사가 전체: 202 응답 → Temporal 워크플로 → NATS → SSE
4. 각 단계마다 같은 이름의 통합 테스트(`apps/api/src/__tests__/integration`)를 나란히 읽는다

| 서비스                                    | 보여주는 것                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `core/theaters`                           | 가장 단순한 CRUD. 새 도메인을 추가할 때 본보기로 복제할 기준                                    |
| `core/movies`                             | 파일 업로드 연동, draft→publish 공개 상태, 상영이 참조 중이면 삭제 거부                         |
| `core/users` · `admins`                   | soft delete × unique 인덱스, 로그인·토큰 회전, 탈퇴·비밀번호 변경 시 세션 폐기                  |
| `core/showtimes` · `tickets`              | 사가가 만들어내는 자원. tickets는 원자 조건부 전이로 상태를 바꾼다                              |
| `core/ticket-holding`                     | Redis Lua 스크립트 선점 — Lua가 여러 키를 원자적으로 다루도록 같은 hash slot에 키를 모으는 설계 |
| `core/purchase-records` · `watch-records` | 사용자 기록 도메인. watch-records는 추천의 입력이 된다                                          |
| `application/booking`                     | 예매 동선 조회와 좌석 선점, 요청 검증                                                           |
| `application/purchase`                    | 구매 확정과 실패 보상, NATS 구독 2형(브로드캐스트·큐 그룹)                                      |
| `application/showtime-creation`           | Temporal 사가, 202+SSE, 분산 락, 보상                                                           |
| `application/recommendation`              | 관람 기록 기반 추천. 도메인 로직을 순수 모듈로 분리                                             |
| `view/user-app/home`                      | 화면 전용 응답 조합 — View 계층                                                                 |
| `infrastructure/assets`                   | presigned 업로드와 체크섬 검증, 만료 업로드 정리 cron(분산 락)                                  |
| `infrastructure/payments`                 | 외부 결제 연동 계층의 자리                                                                      |

## 인가

JWT 기반으로 세 역할을 둔다. **root**는 `.env.api` 자격증명의 Basic 인증으로 admin 생성·삭제만 하고, **admin**(콘솔이 쓰는 역할)은 콘텐츠 관리와 임의 사용자 대상 작업을, **user**(사용자 앱)는 본인 자원만 다룬다. admin과 user 토큰은 서로 다른 secret으로 서명해 교차 사용이 안 된다. 본인 자원은 경로에 식별자가 없는 `/me` 계열로만 다루고(식별자는 토큰 주체로 고정), 임의 ID를 받는 경로는 전부 admin 전용이다. 그래서 로그인 사용자가 ID를 바꿔 남의 자원에 접근하는 경로(IDOR)가 user 역할에는 존재하지 않는다 — 설계 규칙은 [apps 문서](docs/apps.md#본인-자원은-me로-다룬다)를 본다.

## 문서

README 뒤의 상세는 폴더 문서 여섯과 참고 자료 셋이 맡는다. 문서와 주석은 한국어가 원본이다 — 두 언어를 같이 유지하는 동기화 비용을 피했고, 필요한 번역은 AI로 금방 만들 수 있다. 영어 문서는 정리가 끝난 뒤 추가할 예정이다.

**폴더 문서** — 각 폴더가 무엇이고 왜 이렇게 나뉘었는지. 여기서 시작한다:

- [apps/](docs/apps.md) — 본체 API와 최소 데모 두 앱
    - [SoLA 5계층](docs/apps.md#sola-5계층) — 순환 참조를 없애는 계층 규칙
    - [분산 협력](docs/apps.md#분산-협력--msa-준비형-모놀리스) — 분산 락·NATS·Temporal을 쓰는 곳
    - [코드 컨벤션](docs/apps.md#코드-컨벤션) — 이름·에러·가져오기·REST·비정규화
    - [테스트](docs/apps.md#테스트) — 실제 인프라 테스트 규칙과 픽스처
    - [실행 가능한 API 문서](docs/apps.md#실행-가능한-api-문서) — spec 작성 규약과 산출물
- [libs/](docs/libs.md) — 공유 패키지 셋의 분리 기준
- [tests/](docs/tests.md) — 배포된 스택을 밖에서 검증하는 테스트들과 실행법
- [infra/](docs/infra.md) — 개발 인프라 compose 묶음과 그 소비자들
- [deploy/](docs/deploy.md) — Docker Compose 다중 API 컨테이너 + NGINX, `x-replica-id` 응답 헤더
- [.devcontainer/](docs/devcontainer.md) — 환경 변수 주입 경로, `WORKSPACE_ROOT`, DooD

**참고 자료** — 폴더 하나에 속하지 않는 횡단 주제는 `docs/reference/`가 맡는다:

- [튜토리얼](docs/reference/tutorial.md) — 유스케이스에서 테스트까지, 이 시드의 설계 흐름을 처음부터 걷는다 (백엔드 초급자 대상)
- [컨벤션](docs/reference/conventions.md) — 커밋 규칙, fail-fast, 값의 위치, npm 스크립트 계약
- [환경 변수](docs/reference/environment.md) — Dev Container, API, API 문서, console·user-app 환경 변수 흐름과 포크 체크리스트
- [설계 결정](docs/reference/decisions.md) — 분산 도구·View 계층 등 핵심 설계 결정과 쓰지 않기로 한 대안

## 라이선스

[MIT](LICENSE).
