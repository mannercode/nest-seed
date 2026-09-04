# nest-seed

[English](README.en.md)

[![Test AtoZ](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-atoz.yaml)
[![Test Stability](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-stability.yaml)
[![Test API Race](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml/badge.svg)](https://github.com/mannercode/nest-seed/actions/workflows/test-api-race.yaml)

실무 프로젝트의 출발점으로 사용하는 NestJS 모노레포다. 영화 예매라는 익숙한 흐름을 따라 모듈 경계부터 다중 복제본의 경합, 중복 요청, 부분 실패와 복구까지 읽고 실행할 수 있다. `apps/api`가 본체이고 `console`과 `user-app`은 Next.js 연결을 보여 주는 최소 데모다.

이 시드의 특징은 예제·설계·검증을 하나의 흐름으로 연결한 구성에 있다.

- **하나의 도메인으로 이어지는 예제** — 영화·극장 CRUD에서 좌석 선점, 구매, 상영 생성으로 이어지며 동시성·멱등성·복구를 단계적으로 보여 준다. 도메인 기능은 다른 프로젝트에서도 재사용할 설계 패턴을 설명하는 예제로 구성한다.
- **필요한 만큼 적용하는 모듈 경계** — SoLA 5계층에서 같은 계층의 모듈끼리 직접 호출하지 않고, 조합은 위 계층으로 올린다. 각 도메인은 자기 collection을 소유하고 ID·공개 API로 협력한다. Core 하나로 끝나는 CRUD는 Gateway가 직접 호출해 불필요한 Application을 만들지 않는다.
- **모놀리스에서 다루는 분산 실행** — 같은 API를 여러 복제본으로 실행하며 좌석 경쟁, 중복 요청, 복제본 사이의 이벤트 전달을 다룬다. 하나의 애플리케이션에서도 필요한 분산 설계를 확인할 수 있다.
- **문제에 맞춘 보장과 복구 방식** — Redis 락은 경합 비용을 줄이고, DB 원자 전이·CAS·transaction이 정합성을 지킨다. 구매에는 상태 머신과 lease 재조정을, 상영 생성에는 Restate workflow를 적용해 문제에 따른 복구 방식을 비교할 수 있다.
- **변경을 검증할 수 있는 개발 환경** — Dev Container에서 실제 MongoDB Replica Set·Redis Cluster 등을 사용하고, 통합 테스트·다중 복제본 race test·반복 CI로 변경을 검증한다. 커버리지 100%는 실행되지 않은 분기를 변경 시점에 드러내는 개발 제약이다.
- **실행과 판단에 연결되는 문서** — 실행 가능한 API 시나리오로 실제 요청·응답 흐름을 확인하고, 설계 결정 문서에서 선택 이유와 대안·한계를 읽는다. 자신의 프로젝트에 맞춰 무엇을 유지하고 바꿀지 판단할 근거를 제공한다.

계층과 분산 경계는 [apps 문서](docs/apps.md), 선택 이유와 한계는 [설계 결정](docs/reference/decisions.md)에 있다.

## 1. 시작하기

공식 개발 경로는 Dev Container 하나다. Docker와 VS Code Dev Containers 확장이 필요하다.

1. VS Code에서 저장소를 열고 `Reopen in Container`를 실행한다. 첫 부팅은 이미지와 개발 인프라를 준비하므로 시간이 걸릴 수 있다.
2. `pnpm run test`로 기본 검증을 실행한다. 포크 직후 전체 경계를 확인하려면 `pnpm run atoz`를 실행한다.
3. `pnpm run dev`를 실행하고 `curl http://localhost:3000/health`로 API를 확인한다.
4. console(3100)에 개발용 admin(`admin@nest-seed.local` / `DevPass1!`)으로 로그인해 영화와 극장을 만든다. 이 계정은 Dev Container가 인프라를 초기화할 때 자동으로 다시 만든다.
5. user-app(3200)에서 가입·로그인과 홈 화면 조합을 확인한다. 실행 가능한 API 문서는 독립된 fixture 흐름으로 상영·예매·구매 API를 실행한다.

`.env.api`와 `.env.infra`는 커밋된 개발·검증 값이다. 포크할 때 프로젝트 식별자와 자격증명을 검토하고, 운영 secret은 저장소 밖에서 주입한다. 자세한 기준은 [환경 변수](docs/reference/environment.md)에 있다.

## 2. 주요 명령

| 명령                  | 용도                                      |
| --------------------- | ----------------------------------------- |
| `pnpm run dev`        | API와 두 frontend를 watch mode로 실행     |
| `pnpm run test`       | workspace의 단위·통합·계약 테스트         |
| `pnpm run lint`       | 타입, 코드, format, shell, 문서 링크 검사 |
| `pnpm run atoz`       | 포크 직후나 배포 전 실행하는 전체 회귀    |
| `bash infra/reset.sh` | 개발 인프라와 고정 admin fixture를 재생성 |
| `pnpm run api-docs`   | 다중 복제본의 API 문서 검증               |
| `pnpm exec tunnel`    | console과 user-app Quick Tunnel 실행      |

`infra/reset.sh`는 volume을 지운 뒤 고정 admin fixture까지 다시 만드는 개발용 복구 명령이다. Restate journal과 JetStream 데이터도 지우므로 보존할 실행이 있는 환경에서는 사용하지 않는다. 테스트별 명령과 결과 위치는 [tests/README.md](tests/README.md)에 있다.

## 3. API 레퍼런스

정적 Swagger/OpenAPI 대신 실제 요청을 보내는 `apps/api/api-docs/*.spec`를 주요 성공·실패 흐름의 HTTP 계약으로 사용한다. 이 선택은 문서와 동작이 따로 낡는 것을 막기 위한 것이다.

```bash
bash apps/api/api-docs/run.sh                   # 실행 중인 개발 API 대상
bash apps/api/api-docs/run.sh showtime-creation.spec
```

각 `TEST`의 상세 로그에는 실제 응답 본문을 기록한다. 요청은 spec 자체가 보여 주며 준비용 `SETUP`은 문서 항목에 포함하지 않는다. 장기 SSE와 인프라 장애 조건은 통합 테스트가 검증한다. 자세한 규칙은 [실행 가능한 API 문서](docs/apps.md#5-실행-가능한-api-문서)에 있다.

## 4. 프로젝트 구조

```text
.
├── apps/
│   ├── api/             # NestJS API
│   ├── console/         # 관리자용 Next.js 앱
│   └── user-app/        # 사용자용 Next.js 앱
├── libs/
│   ├── common/          # 앱이 운영 중 사용하는 공유 런타임 코드
│   └── testing/         # 테스트 소비자용 client·fixture helper
├── tests/
│   ├── api/             # 공용 다중 복제본 스택, race와 benchmark
│   └── web/             # 브라우저 E2E
├── infra/               # 개발용 MongoDB·Redis·S3·NATS·Restate와 자체 테스트
│   └── tests/           # 인프라 자체의 복구·정합성 보장
├── tools/               # 개발·테스트 실행 도구
└── docs/                # 사람이 읽을 설계·운영 문서
```

## 5. 기술 선택

| 역할                          | 선택                                                   |
| ----------------------------- | ------------------------------------------------------ |
| API·frontend                  | NestJS, Next.js, Zod                                   |
| 주 데이터와 원자성            | MongoDB Replica Set, 공식 Node.js driver               |
| 경합·메시지·durable execution | Redis Cluster, NATS/JetStream, Restate                 |
| 객체 저장                     | AWS SDK와 S3 호환 VersityGW                            |
| 검증                          | Vitest, Testcontainers, Playwright, k6, Docker Compose |

도구는 학습용 나열이 아니라 서로 다른 실패 경계를 맡는다. 왜 이 조합을 골랐고 Kafka·BullMQ·Swagger·Nx 등을 넣지 않았는지는 [설계 결정](docs/reference/decisions.md)이 설명한다.

## 6. 도메인 둘러보기

처음에는 `core/theaters`의 단순한 CRUD, `application/booking`의 Core 조합, `application/showtime-creation`의 durable workflow 순서로 읽는다. 각 구현과 같은 이름의 통합 테스트를 나란히 보면 경계가 더 잘 드러난다.

| 영역                                  | 보여 주는 개념                                        |
| ------------------------------------- | ----------------------------------------------------- |
| `core/movies`, `core/theaters`        | 기본 도메인 구조, publish 상태, 파일 연결             |
| `core/users`, `core/admins`           | 역할별 인증, token 회전, soft delete와 unique index   |
| `core/tickets`, `core/ticket-holding` | 원자 상태 전이와 Redis Lua 기반 좌석 선점             |
| `application/booking`                 | 여러 Core를 조합하는 사용자 동선                      |
| `application/showtime-creation`       | 202, Restate workflow, 상태 조회·SSE, transaction·CAS |
| `application/purchase`                | 멱등 응답, durable 상태 머신, lease 재조정, outbox    |
| `application/recommendation`          | 관람 기록 기반 추천과 순수 도메인 로직                |
| `view/user-app/home`                  | 화면에 맞춘 읽기 응답 조합                            |
| `infrastructure/assets`, `payments`   | S3와 외부 결제의 경계                                 |

## 7. 인가

애플리케이션 역할은 두 가지다. **admin**은 콘텐츠와 임의 사용자 대상 작업을, **user**는 본인 자원만 다룬다. 최초 admin은 HTTP가 아닌 운영 명령으로 준비하며, admin과 user token은 서로 다른 secret으로 서명한다.

본인 자원은 URL의 ID가 아니라 token subject로 고정한 `/me` 경로를 사용하고, 임의 ID를 받는 경로는 admin에게만 허용한다. 두 규칙을 함께 적용해 user가 ID를 바꿔 다른 사용자의 자원에 접근하는 IDOR 경로를 제거한다.

## 8. 운영 적용 범위

`tests/api/compose.yml`은 분산 동작을 확인하는 테스트 스택이지 운영 배포본이 아니다. TLS, secret manager, backup/restore, 관측 backend, frontend edge, 무중단 revision 전환은 포함하지 않는다. 특히 Restate endpoint versioning과 BFF proxy IP 신뢰 경계는 운영 환경에서 별도로 설계해야 한다. [API 스택 문서](docs/api-stack.md)에 필요한 위험과 보장 한계를 정리했다.

## 9. 문서

문서와 주석의 원본 언어는 한국어다. 영어는 이 README만 제공한다.

- [apps](docs/apps.md) — SoLA 계층, 분산 보장, API·테스트 규칙
- [libs](docs/libs.md) — 런타임 공용 코드와 테스트 helper의 분리 기준
- [tests](docs/tests.md) — 외부 스택 검증이 필요한 이유와 결과 해석
- [infra](docs/infra.md) — 개발 topology와 파괴적 reset의 범위
- [API 스택](docs/api-stack.md) — 다중 복제본 검증 및 운영으로 복사하면 안 되는 경계
- [devcontainer](docs/devcontainer.md) — 단일 개발 경로, DooD 제약과 보안
- [decisions](docs/reference/decisions.md) — 선택 이유, 대안, 보장하지 않는 것
- [개발 규칙](docs/reference/conventions.md) — 자동화로 대신할 수 없는 규칙
- [environment](docs/reference/environment.md) — env 소유권과 주입 시점

영화 예매 도메인의 설계 배경은 블로그 연재 [백엔드 서비스 분석과 설계 1](https://mannercode.com/2025/04/01/backend-design-1.html)·[2](https://mannercode.com/2025/05/01/backend-design-2.html)·[3](https://mannercode.com/2025/06/01/backend-design-3.html)에 있다.
