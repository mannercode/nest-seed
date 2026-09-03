# 테스트 검토 인벤토리

이 문서는 활성 테스트가 검증하는 행동을 파일 단위로 확인하고 개선 후보를 추적하는 임시 체크리스트다. 테스트 원칙은 [개발 규칙](../docs/reference/conventions.md#5-테스트-문장은-조건과-결과를-이어-읽게-쓴다), 외부 스택 테스트의 역할은 [tests 문서](../docs/tests.md), 실행 명령과 결과 위치는 [`tests/README.md`](../tests/README.md)가 소유한다.

## 범위

- 활성 workspace에서 `*.spec.ts`, `*.test.{js,cjs,mjs,sh}`처럼 테스트 케이스를 직접 선언하는 파일은 현재 104개다.
- 실행 가능한 curl 문서 `apps/api/api-docs/*.spec`, 분산 race 시나리오, Restate probe와 k6 benchmark는 이름 규칙이 달라 별도 절에 기록한다.
- fixture, mock, 공통 helper처럼 테스트 케이스를 직접 선언하지 않는 파일과 `_todo`에 보관한 프로젝트는 세지 않는다.
- `apps/console`과 `apps/user-app`에는 colocated 테스트 파일이 없다. 두 앱의 계약과 브라우저 흐름은 `tests/web`에서 검증한다.

## 판정

파일별 판정은 다음 뜻으로 사용한다.

| 판정        | 의미                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| `유지`      | 실패가 독립적인 동작·보안·정합성 회귀를 뜻하고 현재 검증 방법도 적절하다.                     |
| `보완`      | 검증 목적은 필요하지만 작은 fixture·국소 mock만으로 더 결정적으로 만들 수 있다.               |
| `축소`      | 일부 가치는 있으나 다른 계층과 겹치거나 설정 문자열을 과도하게 복제하므로 범위를 줄여야 한다. |
| `제거 후보` | 독립적인 실패 신호가 거의 없고 구현·문서의 현재 값을 한 번 더 복사하는 수준이다.              |

시드 적합성은 다음처럼 구분한다.

| 시드   | 의미                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| `핵심` | 포크 후에도 같은 기반 기술을 쓰는 동안 남겨야 하는 재사용 가능한 안전장치다.             |
| `예제` | 영화 예매 예제 코드와 함께 있어야 하지만 새 도메인으로 교체할 때 같이 바뀌거나 사라진다. |
| `선택` | 특정 개발 도구, CI 비용 정책이나 운영 편의 기능을 채택할 때만 필요하다.                  |

각 파일의 목적 바로 다음 줄에 판정을 적었다. 별도 지적이 없는 `유지`는 목적 문장 자체가 유지 근거다. `보완`과 `축소`는 문제와 바꿀 방법을 같은 줄에 적었다.

| 범위                              | 유지 | 보완 | 축소 | 제거 후보 |
| --------------------------------- | ---: | ---: | ---: | --------: |
| 표준 테스트 104개                 |   97 |    2 |    5 |         0 |
| API 문서·race·benchmark·배포 24개 |   24 |    0 |    0 |         0 |

## 표준 테스트 파일 104개

### `apps/api` — 48개

#### 테스트 실행·격리와 API 문서 로그

- [`api-docs/redaction.test.sh`](../apps/api/api-docs/redaction.test.sh) — API 문서 실행 로그에서 인증 헤더, 쿠키, 토큰, 비밀번호와 서명 값을 가리는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/shared-test-mongo-connection.test.cjs`](../apps/api/scripts/__tests__/shared-test-mongo-connection.test.cjs) — 파일 수명의 native Mongo client와 database를 공유하고 개별 테스트가 직접 닫지 않는 계약을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/vitest-command-contract.test.cjs`](../apps/api/scripts/__tests__/vitest-command-contract.test.cjs) — 일반·AtoZ·Stability Vitest 명령, coverage 위치와 setup 실패 후 정리 계약을 검사한다.
  **판정: 축소 · 시드: 선택.** 실제 병렬 실행 테스트와 겹치는 명령 문자열 검사는 빼고, setup 실패 시 정리되는 동작만 남기는 편이 낫다.
- [`scripts/__tests__/vitest-invocation-isolation.test.cjs`](../apps/api/scripts/__tests__/vitest-invocation-isolation.test.cjs) — 실제 Vitest 두 프로세스를 동시에 실행해 Mongo, S3, Redis, JetStream과 출력 디렉터리가 run별로 격리되는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/vitest-teardown-contract.test.cjs`](../apps/api/scripts/__tests__/vitest-teardown-contract.test.cjs) — 실제 teardown이 현재 run의 Mongo, S3, Redis와 JetStream 자원만 선택하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### API 모듈과 통합 흐름

- [`src/__tests__/app.module.spec.ts`](../apps/api/src/__tests__/app.module.spec.ts) — 실제 `AppModule` 그래프가 테스트용 `PROJECT_ID`로 모든 의존성을 생성하는지 확인한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/health.spec.ts`](../apps/api/src/__tests__/health.spec.ts) — `GET /health`의 통합 상태 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/vitest-resource-isolation.spec.ts`](../apps/api/src/__tests__/vitest-resource-isolation.spec.ts) — run/worker/test namespace와 병렬 teardown의 Mongo, S3, Redis, JetStream 격리를 실제 인프라에서 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/application/booking.spec.ts`](../apps/api/src/__tests__/application/booking.spec.ts) — 영화·극장·상영 조회, 티켓 조회와 좌석 선점으로 이어지는 고객 예매 흐름을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/purchase.spec.ts`](../apps/api/src/__tests__/application/purchase.spec.ts) — 티켓 구매, 멱등성, 원자 상태 전이, 내부 실패와 보상 경로를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/purchase-events.spec.ts`](../apps/api/src/__tests__/application/purchase-events.spec.ts) — 구매 이벤트 발행·구독과 알림 서비스 lifecycle을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/recommendation.spec.ts`](../apps/api/src/__tests__/application/recommendation.spec.ts) — 로그인 사용자와 게스트의 영화 추천 결과를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/showtime-creation.spec.ts`](../apps/api/src/__tests__/application/showtime-creation.spec.ts) — 상영 생성용 조회, 검색, SSE 상태 이벤트, Restate workflow와 트랜잭션 실패 복구를 검증한다.
  **판정: 유지 · 시드: 예제.** 5.1초 대기는 Restate의 실제 5초 경계를 넘어 완료 응답 유실과 durable retry를 재현하므로 fake timer로 바꾸지 않는다.
- [`src/__tests__/core/admin-auth.spec.ts`](../apps/api/src/__tests__/core/admin-auth.spec.ts) — 관리자 로그인, 현재 사용자, refresh와 logout API를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/admin-management.spec.ts`](../apps/api/src/__tests__/core/admin-management.spec.ts) — root의 관리자 생성·삭제, Basic Auth 경계와 관리자 본인 수정을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies.spec.ts`](../apps/api/src/__tests__/core/movies.spec.ts) — 영화 CRUD, 목록과 이미지 조회 계약을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies-assets.spec.ts`](../apps/api/src/__tests__/core/movies-assets.spec.ts) — 영화 에셋 추가·완료·삭제와 영화 삭제 시 에셋 정리를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies-publish.spec.ts`](../apps/api/src/__tests__/core/movies-publish.spec.ts) — 필수 정보가 갖춰진 영화의 발행과 유효성 실패를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/purchase-records.spec.ts`](../apps/api/src/__tests__/core/purchase-records.spec.ts) — 구매 기록 생성·사용자 조회와 durable purchase 상태를 검증한다.
  **판정: 유지 · 시드: 예제.** 50ms 대기는 Mongo fixture에 시간 주입 경로를 추가하는 것보다 작고, 정렬에 필요한 서로 다른 실제 생성 시각을 검증한다.
- [`src/__tests__/core/showtimes.spec.ts`](../apps/api/src/__tests__/core/showtimes.spec.ts) — 상영 일괄 생성과 ID·시간·영화·극장·날짜 검색을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/theaters.spec.ts`](../apps/api/src/__tests__/core/theaters.spec.ts) — 극장 CRUD와 목록 조회를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/ticket-holding.spec.ts`](../apps/api/src/__tests__/core/ticket-holding.spec.ts) — 좌석 선점, 기존 선점 처리, 선점 조회와 구매 claim을 검증한다.
  **판정: 유지 · 시드: 예제.** Redis TTL 만료 조건을 `beforeEach`에서 두 번 만들더라도 빈 조회와 다른 고객의 선점 성공을 별도 `it`으로 유지한다. 두 검증은 순서를 가진 하나의 흐름이 아니므로 `beforeAll` 공유 대상이 아니다.
- [`src/__tests__/core/tickets.spec.ts`](../apps/api/src/__tests__/core/tickets.spec.ts) — 티켓 생성·검색·판매 원자 전이와 매출 집계를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/user-auth.spec.ts`](../apps/api/src/__tests__/core/user-auth.spec.ts) — 사용자 로그인, 내 정보, 계정 수정·삭제, 구매 목록, refresh, logout과 logout-all을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/users.spec.ts`](../apps/api/src/__tests__/core/users.spec.ts) — 사용자 CRUD, 인가 경계와 페이지 목록을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/watch-records.spec.ts`](../apps/api/src/__tests__/core/watch-records.spec.ts) — 시청 기록 생성과 페이지 검색을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/infrastructure/assets.spec.ts`](../apps/api/src/__tests__/infrastructure/assets.spec.ts) — 업로드 URL 생성·만료, 완료 확인·확정, 조회·삭제와 만료 업로드 정리를 검증한다.
  **판정: 축소 · 시드: 핵심.** S3 presigned URL과 서로 다른 만료 결과의 독립된 테스트는 유지한다. cron callback 뒤 1초 sleep만 `cleanupExpiredUploads()`를 직접 await해 없앤다.
- [`src/__tests__/infrastructure/payments.spec.ts`](../apps/api/src/__tests__/infrastructure/payments.spec.ts) — 결제 생성·취소와 구매별 조회를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/view/home.spec.ts`](../apps/api/src/__tests__/view/home.spec.ts) — 사용자 홈의 가까운 상영과 구성 결과를 검증한다.
  **판정: 유지 · 시드: 예제.**

#### 구성·도메인 단위 테스트

- [`src/config/__tests__/app-config.service.spec.ts`](../apps/api/src/config/__tests__/app-config.service.spec.ts) — 애플리케이션 환경변수 스키마와 파생 설정을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/config/__tests__/connections.spec.ts`](../apps/api/src/config/__tests__/connections.spec.ts) — 소유 Mongo client만 module destroy에서 닫고 공유 client는 보존하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/config/__tests__/mongo-driver-options.spec.ts`](../apps/api/src/config/__tests__/mongo-driver-options.spec.ts) — 애플리케이션 수명과 테스트 파일 수명별 Mongo pool·write concern 옵션을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/modules/health/__tests__/restate.health-indicator.spec.ts`](../apps/api/src/modules/health/__tests__/restate.health-indicator.spec.ts) — Restate ingress health의 성공, HTTP 오류와 요청 실패 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/booking/__tests__/booking-utils.spec.ts`](../apps/api/src/services/application/booking/__tests__/booking-utils.spec.ts) — 예매 화면에 표시할 상영 정보 생성·정렬을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/recommendation/domain/__tests__/movie-recommender.spec.ts`](../apps/api/src/services/application/recommendation/domain/__tests__/movie-recommender.spec.ts) — 시청 이력 기반 영화 추천 순위와 fallback을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/showtime-creation/dtos/__tests__/schemas.spec.ts`](../apps/api/src/services/application/showtime-creation/dtos/__tests__/schemas.spec.ts) — 상영 생성·검색 요청 스키마의 변환과 유효성 경계를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/showtime-creation/worker/__tests__/restate-endpoint.service.spec.ts`](../apps/api/src/services/application/showtime-creation/worker/__tests__/restate-endpoint.service.spec.ts) — Restate HTTP/2 endpoint 시작·종료, 강제 session 정리와 로그 매핑을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/restate-workflow-client.service.spec.ts`](../apps/api/src/services/application/showtime-creation/worker/__tests__/restate-workflow-client.service.spec.ts) — workflow 제출·완료 대기, timeout·retry와 ingress 오류 전달을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/temporal-json.serde.spec.ts`](../apps/api/src/services/application/showtime-creation/worker/__tests__/temporal-json.serde.spec.ts) — Restate wire/journal에서 Temporal 값과 빈 payload의 직렬화 왕복을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts`](../apps/api/src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts) — 상영 생성 Restate workflow의 durable step, 상태 이벤트, 충돌·취소·재시도·terminal error 분류를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/admins/dtos/__tests__/schemas.spec.ts`](../apps/api/src/services/core/admins/dtos/__tests__/schemas.spec.ts) — 관리자 요청 DTO 스키마를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/admins/internal/__tests__/admin-authentication.service.spec.ts`](../apps/api/src/services/core/admins/internal/__tests__/admin-authentication.service.spec.ts) — 관리자 인증 payload가 현재 계정 상태와 일치하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/theaters/models/__tests__/seatmap.spec.ts`](../apps/api/src/services/core/theaters/models/__tests__/seatmap.spec.ts) — 좌석 수 계산과 전체 좌석 펼치기를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/__tests__/users-pagination.spec.ts`](../apps/api/src/services/core/users/__tests__/users-pagination.spec.ts) — 사용자 목록의 안정적인 pagination과 필터를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/__tests__/users-write-concern-recovery.spec.ts`](../apps/api/src/services/core/users/__tests__/users-write-concern-recovery.spec.ts) — 사용자 생성 write concern 불확실성 뒤 실제 저장 결과를 재조회해 복구하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/dtos/__tests__/schemas.spec.ts`](../apps/api/src/services/core/users/dtos/__tests__/schemas.spec.ts) — 사용자 요청 DTO 스키마를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/internal/__tests__/user-authentication.service.spec.ts`](../apps/api/src/services/core/users/internal/__tests__/user-authentication.service.spec.ts) — 비밀번호 hash·검증, credential 조회와 인증 payload 활성 상태를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/gateway/pipes/__tests__/request-validation.pipe.spec.ts`](../apps/api/src/services/gateway/pipes/__tests__/request-validation.pipe.spec.ts) — body·배열·중첩 요청의 Standard Schema 검증과 오류 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `libs/common` — 37개

#### 인증·캐시·설정

- [`src/auth/__tests__/guards.spec.ts`](../libs/common/src/auth/__tests__/guards.spec.ts) — Bearer, Basic, 복합·optional 인증 guard의 헤더 파싱과 오류 경계를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/auth/__tests__/jwt-auth.service.spec.ts`](../libs/common/src/auth/__tests__/jwt-auth.service.spec.ts) — access/refresh 발급, 원자 refresh 회전, 폐기, 전체 로그아웃과 보안 이벤트를 검증한다.
  **판정: 보완 · 시드: 핵심.** 전역 시간을 바꾸지 않고 각 만료 분기가 `expiresIn: '-1s'`인 유효한 refresh token fixture를 사용하면 별도 `it`을 합치지 않고도 8초 대기와 프로덕션 변경을 모두 피할 수 있다.
- [`src/cache/__tests__/cache.service.spec.ts`](../libs/common/src/cache/__tests__/cache.service.spec.ts) — Redis cache set/delete/script, lock·blocking lock, 복구와 namespace 격리를 검증한다.
  **판정: 유지 · 시드: 핵심.** Redis 서버의 TTL과 lock 소유권 만료가 검증 대상이므로 real sleep을 유지한다. polling은 만료 시점을 앞당기지 못하고 코드만 늘린다.
- [`src/config/__tests__/base-config.service.spec.ts`](../libs/common/src/config/__tests__/base-config.service.spec.ts) — 문자열·숫자·boolean 환경 설정 조회와 오류를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/date-time-range/__tests__/date-time-range.spec.ts`](../libs/common/src/date-time-range/__tests__/date-time-range.spec.ts) — 날짜·시간 범위 생성과 경계 유효성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/idempotency/__tests__/errors.spec.ts`](../libs/common/src/idempotency/__tests__/errors.spec.ts) — 멱등성 오류 코드와 응답 형태를 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### health·인프라 모듈

- [`src/health/__tests__/nats.health-indicator.spec.ts`](../libs/common/src/health/__tests__/nats.health-indicator.spec.ts) — NATS health 성공·실패를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/health/__tests__/redis.health-indicator.spec.ts`](../libs/common/src/health/__tests__/redis.health-indicator.spec.ts) — Redis health 성공·실패를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/mongodb/__tests__/crud.repository.spec.ts`](../libs/common/src/mongodb/__tests__/crud.repository.spec.ts) — Mongo CRUD repository의 초기화, insert/mapping, 조회·삭제와 pagination 계약을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/mongodb/__tests__/mongo.util.spec.ts`](../libs/common/src/mongodb/__tests__/mongo.util.spec.ts) — ObjectId, 문서 mapping, query builder, Mongo 오류와 plain object helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/nats/__tests__/nats-pubsub.service.spec.ts`](../libs/common/src/nats/__tests__/nats-pubsub.service.spec.ts) — NATS publish/subscribe, 소비 loop 오류, decorator와 module 등록을 검증한다.
  **판정: 유지 · 시드: 핵심.** 도착 검증은 이미 bounded polling을 사용한다. 남은 고정 대기는 unsubscribe 뒤 메시지가 오지 않는다는 음의 assertion의 관찰 창이므로 유지한다.
- [`src/nats/__tests__/nats.module.spec.ts`](../libs/common/src/nats/__tests__/nats.module.spec.ts) — NATS connection token, registry와 module 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/redis/__tests__/redis.module.spec.ts`](../libs/common/src/redis/__tests__/redis.module.spec.ts) — standalone Redis registry와 `forRoot`/`forRootAsync` 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/redis/__tests__/redis.module.cluster.spec.ts`](../libs/common/src/redis/__tests__/redis.module.cluster.spec.ts) — Redis cluster module 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/s3/__tests__/s3-object.service.spec.ts`](../libs/common/src/s3/__tests__/s3-object.service.spec.ts) — presigned upload/download, 메타데이터·체크섬·크기 제한, 완료 확인, 목록·삭제·put과 client 종료를 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### 로깅·도메인 helper

- [`src/lat-long/__tests__/lat-long.spec.ts`](../libs/common/src/lat-long/__tests__/lat-long.spec.ts) — 위경도 거리 계산과 HTTP 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/app-logger.service.spec.ts`](../libs/common/src/logger/__tests__/app-logger.service.spec.ts) — 애플리케이션 logger의 level·context 전달을 검증한다.
  **판정: 축소 · 시드: 핵심.** level별 동일 위임 검사는 table-driven 한 묶음으로 합칠 수 있다.
- [`src/logger/__tests__/create-winston-logger.spec.ts`](../libs/common/src/logger/__tests__/create-winston-logger.spec.ts) — Winston logger 생성과 포맷·transport 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/exception-logger.filter.spec.ts`](../libs/common/src/logger/__tests__/exception-logger.filter.spec.ts) — HTTP·비HTTP 예외 로깅과 성공 interceptor 부재 시 timing 처리를 검증한다.
  **판정: 유지 · 시드: 핵심.** 실제 HTTP interceptor부터 filter까지의 50ms 경계를 보는 테스트이며 별도 clock 주입보다 현재 코드가 단순하다.
- [`src/logger/__tests__/redact.spec.ts`](../libs/common/src/logger/__tests__/redact.spec.ts) — 민감 필드 redaction을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/request-timing.spec.ts`](../libs/common/src/logger/__tests__/request-timing.spec.ts) — 요청 시작·종료 시간 측정을 검증한다.
  **판정: 유지 · 시드: 핵심.** 총 80ms의 `performance.now()` 검증을 위해 clock seam이나 fake timer를 추가할 실익이 없다.
- [`src/logger/__tests__/success-logger.interceptor.spec.ts`](../libs/common/src/logger/__tests__/success-logger.interceptor.spec.ts) — 성공 요청 로그와 제외 경로 동작을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/pagination/__tests__/pagination.spec.ts`](../libs/common/src/pagination/__tests__/pagination.spec.ts) — pagination DTO 기본값·경계와 HTTP 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### 범용 utility

- [`src/utils/__tests__/async.spec.ts`](../libs/common/src/utils/__tests__/async.spec.ts) — 비동기 sleep helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/base64.spec.ts`](../libs/common/src/utils/__tests__/base64.spec.ts) — Base64 인코딩·디코딩을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/byte.spec.ts`](../libs/common/src/utils/__tests__/byte.spec.ts) — byte 문자열 parsing·formatting과 잘못된 단위를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/checksum.spec.ts`](../libs/common/src/utils/__tests__/checksum.spec.ts) — checksum 스키마, 파일·buffer hash를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/date.schema.spec.ts`](../libs/common/src/utils/__tests__/date.schema.spec.ts) — Temporal 날짜·시간 입력 스키마를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/date.spec.ts`](../libs/common/src/utils/__tests__/date.spec.ts) — 날짜 생성·변환·최솟값·최댓값·현재 시각·덧셈과 외부 `Date` 경계를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/env.spec.ts`](../libs/common/src/utils/__tests__/env.spec.ts) — 환경변수 문자열·숫자·boolean parsing을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/http.spec.ts`](../libs/common/src/utils/__tests__/http.spec.ts) — `Content-Disposition` 생성과 escaping을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/id.spec.ts`](../libs/common/src/utils/__tests__/id.spec.ts) — 짧은 ID 생성과 객체 ID 추출을 검증한다.
  **판정: 축소 · 시드: 핵심.** 형식·길이 검사는 남기고 임의 ID 두 개가 다르다는 확률 단언만 제거한다. 이 테스트를 위해 난수원 주입 코드는 추가하지 않는다.
- [`src/utils/__tests__/json.spec.ts`](../libs/common/src/utils/__tests__/json.spec.ts) — JSON parse/stringify, Temporal·오류·특수값 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/lodash.spec.ts`](../libs/common/src/utils/__tests__/lodash.spec.ts) — 프로젝트 내부 lodash 대체 helper의 조회·선택·집계·비교 동작을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/path.spec.ts`](../libs/common/src/utils/__tests__/path.spec.ts) — 절대 경로, basename/dirname과 파일시스템 경계를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/time.spec.ts`](../libs/common/src/utils/__tests__/time.spec.ts) — 시간 단위와 millisecond 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/validator.spec.ts`](../libs/common/src/utils/__tests__/validator.spec.ts) — `Require`, `Assume`, `ensure` 유효성 helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `libs/testing` — 6개

- [`src/__tests__/create-test-context.spec.ts`](../libs/testing/src/__tests__/create-test-context.spec.ts) — Nest test context 생성, override와 lifecycle을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/create-test-context-cleanup.spec.ts`](../libs/testing/src/__tests__/create-test-context-cleanup.spec.ts) — setup 중 실패했을 때 부분 생성된 test context를 정리하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/expect-equal-unsorted.spec.ts`](../libs/testing/src/__tests__/expect-equal-unsorted.spec.ts) — 순서와 무관한 동등성 matcher를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/http.test-client.spec.ts`](../libs/testing/src/__tests__/http.test-client.spec.ts) — JSON 응답, 상태 코드, multipart, SSE와 chain API를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/utils.spec.ts`](../libs/testing/src/__tests__/utils.spec.ts) — Temporal fixture, 단계 실행, test ID, ObjectId와 debug 감지를 검증한다.
  **판정: 보완 · 시드: 핵심.** 프로덕션 인자를 추가하지 않고 `node:inspector`의 `url()`만 국소 mock해 debugger 연결·비연결 두 경우를 검증한다.
- [`src/vitest/__tests__/decorator-metadata.spec.ts`](../libs/testing/src/vitest/__tests__/decorator-metadata.spec.ts) — TypeScript 기반 Vitest 변환이 Nest DI decorator metadata를 보존하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `tests/api-race/contracts` — 2개

- [`race-common.test.js`](../tests/api-race/contracts/race-common.test.js) — HTTP 전체 deadline과 SSE handshake deadline, 정상 응답 parsing과 연결 정리를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`repository-contract.test.js`](../tests/api-race/contracts/repository-contract.test.js) — 실제 race 파일 목록이 Stability workflow와 문서의 시나리오 목록과 일치하는지 검사한다.
  **판정: 축소 · 시드: 선택.** 시나리오가 workflow에 모두 등록됐다는 보장은 유효하지만 문서 문자열과의 대조는 하나의 manifest 생성으로 대체한다.

### `tests/web` — 4개

- [`contracts/bff-proxy.spec.ts`](../tests/web/contracts/bff-proxy.spec.ts) — Console/User BFF의 Origin·Host와 proxy IP 신뢰 경계, refresh 재시도 시 회전 쿠키 보존을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`e2e/console-auth-flow.spec.ts`](../tests/web/e2e/console-auth-flow.spec.ts) — 관리자 route 보호, 역할 분리, HttpOnly 세션, refresh 단일화, cache 금지, logout, IP rate limit과 body 제한을 브라우저로 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`e2e/movies-flow.spec.ts`](../tests/web/e2e/movies-flow.spec.ts) — 관리자 로그인 후 영화 생성·수정·발행 재시도, 극장 생성과 사용자 삭제를 브라우저로 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`e2e/user-auth-flow.spec.ts`](../tests/web/e2e/user-auth-flow.spec.ts) — 사용자 역할 분리, 로그인·개인화 홈, access 만료 후 refresh 회전과 logout을 브라우저로 검증한다.
  **판정: 유지 · 시드: 예제.**

### `tools` — 7개

- [`__tests__/ci-diagnostics.test.mjs`](../tools/__tests__/ci-diagnostics.test.mjs) — CI 진단 wrapper가 stdout/stderr를 보존하고 원래 종료 코드를 전달하는지 검증한다.
  **판정: 유지 · 시드: 선택.**
- [`__tests__/clean-workspace.test.mjs`](../tools/__tests__/clean-workspace.test.mjs) — 생성물만 지우고 개인 파일·테스트 보고서를 보존하며 symlink workspace를 거부하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`__tests__/lint-shell.test.mjs`](../tools/__tests__/lint-shell.test.mjs) — extension 없는 hook과 source된 fixture까지 shell lint 대상에 포함되는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`__tests__/nginx-log-contract.test.mjs`](../tools/__tests__/nginx-log-contract.test.mjs) — NGINX access log가 query string을 기록하지 않아 URL의 민감값을 노출하지 않는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`dev-tools/tunnel-policy.test.sh`](../tools/dev-tools/tunnel-policy.test.sh) — cloudflared quick tunnel의 허용 포트, 시작 실패, 중복 실행과 child process 정리를 검증한다.
  **판정: 유지 · 시드: 선택.**
- [`vitest-helpers/__tests__/helpers.test.js`](../tools/vitest-helpers/__tests__/helpers.test.js) — test resource ID, Mongo/S3/Redis 준비·정리와 Vitest lifecycle 연결을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`vitest-helpers/__tests__/resource-scope.test.js`](../tools/vitest-helpers/__tests__/resource-scope.test.js) — 병렬 run의 Mongo/S3/Redis namespace와 fail-closed 정리 범위를 검증한다.
  **판정: 유지 · 시드: 핵심.**

## 이름 규칙 밖의 실행 테스트와 측정 파일

### 실행 가능한 API 문서 — 9개, `TEST` 검증 82건

이 파일들은 `api-docs/run.sh`가 source해서 실제 배포 API에 curl 요청을 보낸다. 각 성공·실패 요청의 예상 HTTP status를 검사하고 실제 응답 body와 오류 code를 문서 로그에 남긴다. 따라서 API 통합 테스트와 같은 endpoint를 호출하더라도 중복 테스트로 보지 않는다.

- [`admins.spec`](../apps/api/api-docs/admins.spec) — root/admin 생성·인증·수정·삭제와 권한 오류 13건.
  **판정: 유지 · 시드: 예제.** Basic Auth 누락·비밀번호 오류·잘못된 scheme, 이메일 충돌과 폐기된 refresh token처럼 서로 다른 실패 응답을 문서화한다.
- [`booking.spec`](../apps/api/api-docs/booking.spec) — 극장·상영일·상영시간·티켓 조회와 선점 5건.
  **판정: 유지 · 시드: 예제.** 이미 배포된 API의 문서 예제가 끝까지 작동하는지 보는 경계라 통합 테스트와의 endpoint 중복이 타당하다.
- [`health.spec`](../apps/api/api-docs/health.spec) — 서비스 health 1건.
  **판정: 유지 · 시드: 핵심.** 비용이 작고 배포 stack의 최소 생존 신호라 남긴다.
- [`movies.spec`](../apps/api/api-docs/movies.spec) — 영화 CRUD·목록·발행과 오류 12건.
  **판정: 유지 · 시드: 예제.** CRUD·발행·presigned upload의 전체 curl 예시와 조회·수정 404 응답을 함께 문서화한다.
- [`purchases.spec`](../apps/api/api-docs/purchases.spec) — 티켓 구매, 멱등 재시도·충돌과 사용자 구매 조회 5건.
  **판정: 유지 · 시드: 예제.** 배포 환경의 구매·멱등성 흐름을 함께 증명하므로 통합 테스트와 실행 경계가 다르다.
- [`showtime-creation.spec`](../apps/api/api-docs/showtime-creation.spec) — 상영 생성용 자원 조회, workflow 요청·영속 최종 상태와 검색 5건.
  **판정: 유지 · 시드: 예제.** Restate가 연결된 배포 workflow의 실제 호출 예제로 필요하다.
- [`theaters.spec`](../apps/api/api-docs/theaters.spec) — 극장 CRUD와 validation 8건.
  **판정: 유지 · 시드: 예제.** 정상 CRUD와 필수 값 누락 400, 조회·수정 404의 공개 응답을 문서화한다.
- [`users.spec`](../apps/api/api-docs/users.spec) — 가입·로그인·refresh·내 정보·관리·인가 오류 31건.
  **판정: 유지 · 시드: 예제.** 가입 validation·409, 로그인·refresh 401, 사용자/admin 권한 경계, logout·계정 삭제 이후 상태까지 공개 성공·실패 계약을 문서화한다.
- [`views.spec`](../apps/api/api-docs/views.spec) — 게스트와 로그인 사용자의 홈 view 2건.
  **판정: 유지 · 시드: 예제.** 게스트와 로그인 사용자의 배포 응답 차이를 보여 주는 최소 문서 예제다.

### 4-replica API race — 시나리오 8개와 probe 1개

- [`user-signup-race.js`](../tests/api-race/user-signup-race.js) — 같은 이메일 동시 가입에서 정확히 하나만 생성되는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`jwt-refresh-race.js`](../tests/api-race/jwt-refresh-race.js) — 같은 refresh token 동시 회전에서 하나만 성공하고 승자 token family가 유지되는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`ticket-holding-race.js`](../tests/api-race/ticket-holding-race.js) — 같은 좌석 동시 선점에서 그룹마다 하나만 성공하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`showtime-overlap-race.js`](../tests/api-race/showtime-overlap-race.js) — 서로 겹치는 상영 생성 workflow 중 하나만 성공하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`purchase-double-spend.js`](../tests/api-race/purchase-double-spend.js) — 같은 티켓 묶음 동시 결제에서 하나의 실제 구매만 남는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`purchase-overlap-race.js`](../tests/api-race/purchase-overlap-race.js) — 일부 티켓이 겹치는 다른 lock key의 구매에서 원자 전이와 패자 보상을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`sse-fanout-race.js`](../tests/api-race/sse-fanout-race.js) — 여러 replica의 모든 SSE client가 모든 workflow 성공 이벤트를 받는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`replica-chaos.js`](../tests/api-race/replica-chaos.js) — 트래픽 중 replica 하나를 kill/start해 NGINX 우회와 복구 후 replica 참여를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`probes/restate-journal-recovery.js`](../tests/api-race/probes/restate-journal-recovery.js) — Restate SIGKILL 재시작 뒤 완료 step은 replay하고 중단 step만 다시 실행하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**

### API benchmark — 합격/실패가 아닌 비교 측정

- [`harness-crud.js`](../tests/api-benchmark/harness-crud.js) — 사용자·극장·health 등 CRUD 읽기/쓰기 시나리오의 RPS와 latency를 측정한다.
  **판정: 유지 · 시드: 선택.**
- [`harness-refresh.js`](../tests/api-benchmark/harness-refresh.js) — refresh token 회전 경로의 Redis·Mongo 결합 비용을 측정한다.
  **판정: 유지 · 시드: 선택.**
- [`harness-user-filter.js`](../tests/api-benchmark/harness-user-filter.js) — 사용자 이름 부분 문자열 검색의 collection scan 비용을 측정한다.
  **판정: 유지 · 시드: 선택.** 영화 예제의 사용자 검색을 버리면 함께 교체한다.
- [`mixed-runner.sh`](../tests/api-benchmark/mixed-runner.sh) — 단독 read/write와 혼합 부하 행렬을 실행하고 결과를 비교한다.
  **판정: 유지 · 시드: 선택.**
- [`runner.sh`](../tests/api-benchmark/runner.sh) — 배포 스택 기동, 대량 seed, 측정과 정리를 한 번에 수행한다.
  **판정: 유지 · 시드: 선택.**

### 배포 검증

- [`deploy/verify.sh`](../deploy/verify.sh) — 실제 compose stack을 build·기동하고 Restate endpoint 등록, journal recovery probe와 9개 spec의 82건 curl 검증을 실행한 뒤 stack을 정리한다.
  **판정: 유지 · 시드: 핵심.** build 결과물·Compose wiring·Restate 등록을 함께 보는 artifact-level acceptance라 단위 테스트로 대체할 수 없다.

검토한 개선 후보를 모두 처리하거나 기각하면 이 문서를 삭제한다.
