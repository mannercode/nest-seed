# 테스트 파일 인벤토리

활성 표준 테스트 87개와 그 밖의 실행·측정 파일 24개를 경로별로 정리한다. fixture, helper와 `_todo`는 제외한다. 테스트 작성 기준은 [개발 규칙](../docs/reference/conventions.md#5-테스트-문장은-조건과-결과를-이어-읽게-쓴다)를 따른다.

## `apps/api`

```text
apps/api/
├── api-docs/                                      — 실제 배포 API 응답을 남기는 실행 문서 9개·요청 75건
│   ├── admins.spec                               — 관리자 로그인·refresh·조회·수정·logout과 오류 응답
│   ├── booking.spec                              — 극장·상영·티켓 조회와 좌석 선점 응답
│   ├── health.spec                               — 서비스 health 응답
│   ├── movies.spec                               — 영화 CRUD·목록·발행과 오류 응답
│   ├── purchases.spec                            — 티켓 구매·멱등 재시도·충돌·구매 조회 응답
│   ├── showtime-creation.spec                    — 상영 생성 workflow·최종 상태·검색 응답
│   ├── theaters.spec                             — 극장 CRUD와 validation 응답
│   ├── users.spec                                — 사용자 가입·인증·관리·인가 응답
│   └── views.spec                                — 게스트와 로그인 사용자의 홈 view 응답
└── src/
    ├── __tests__/
    │   ├── health.spec.ts                        — GET /health 통합 응답
    │   ├── application/
    │   │   ├── booking.spec.ts                  — 조회에서 좌석 선점으로 이어지는 고객 예매 흐름
    │   │   ├── purchase-events.spec.ts          — 구매 이벤트 발행·구독과 알림 lifecycle
    │   │   ├── purchase.spec.ts                 — 티켓 구매·멱등성·원자 상태 전이·보상
    │   │   ├── recommendation.spec.ts           — 로그인 사용자와 게스트의 영화 추천
    │   │   └── showtime-creation.spec.ts        — 상영 생성·검색·SSE·Restate workflow·실패 복구
    │   ├── core/
    │   │   ├── admin-auth.spec.ts               — 관리자 로그인·현재 사용자·refresh·logout API
    │   │   ├── admin-management.spec.ts         — 관리자 lifecycle의 HTTP 경계와 service 관리
    │   │   ├── movies-assets.spec.ts            — 영화 에셋 추가·완료·삭제·정리
    │   │   ├── movies-publish.spec.ts           — 영화 발행과 필수 정보 유효성
    │   │   ├── movies.spec.ts                   — 영화 CRUD·목록·이미지 조회
    │   │   ├── purchase-records.spec.ts        — 구매 기록 생성·사용자 조회·durable purchase 상태
    │   │   ├── showtimes.spec.ts                — 상영 일괄 생성과 ID·시간·영화·극장·날짜 검색
    │   │   ├── theaters.spec.ts                 — 극장 CRUD와 목록 조회
    │   │   ├── ticket-holding.spec.ts           — 좌석 선점·조회·기존 선점 처리·구매 claim
    │   │   ├── tickets.spec.ts                  — 티켓 생성·검색·판매 원자 전이·매출 집계
    │   │   ├── user-auth.spec.ts                — 사용자 인증·계정 관리·구매 조회·logout
    │   │   ├── users.spec.ts                    — 사용자 CRUD·인가·pagination
    │   │   └── watch-records.spec.ts            — 시청 기록 생성과 pagination 검색
    │   ├── infrastructure/
    │   │   ├── assets.spec.ts                   — 업로드 URL·에셋 완료·조회·삭제·만료 정리
    │   │   └── payments.spec.ts                 — 결제 생성·취소와 구매별 조회
    │   └── view/
    │       └── home.spec.ts                     — 사용자 홈의 가까운 상영과 구성 결과
    ├── config/__tests__/
    │   ├── app-config.service.spec.ts            — 환경변수 스키마와 파생 설정
    │   ├── connections.spec.ts                   — 소유 Mongo client의 lifecycle
    │   └── mongo-driver-options.spec.ts          — 수명별 Mongo pool·write concern 설정
    ├── modules/health/__tests__/
    │   └── restate.health-indicator.spec.ts      — Restate ingress health의 성공·HTTP 오류·요청 실패
    └── services/
        ├── application/
        │   ├── booking/__tests__/
        │   │   └── booking-utils.spec.ts     — 예매 화면의 상영 정보 생성·정렬
        │   ├── recommendation/domain/__tests__/
        │   │   └── movie-recommender.spec.ts — 시청 이력 기반 추천 순위와 fallback
        │   └── showtime-creation/
        │       ├── dtos/__tests__/
        │       │   └── schemas.spec.ts               — 상영 생성·검색 요청 스키마
        │       └── worker/__tests__/
        │           ├── restate-endpoint.service.spec.ts — Restate HTTP/2 endpoint lifecycle과 로그 매핑
        │           ├── restate-workflow-client.service.spec.ts — workflow 제출·완료 대기·timeout·retry
        │           ├── temporal-json.serde.spec.ts      — Restate wire/journal의 Temporal값과 빈 payload 직렬화
        │           └── workflow.spec.ts                 — workflow step·상태·충돌·취소·재시도
        ├── core/
        │   ├── admins/
        │   │   ├── dtos/__tests__/schemas.spec.ts — 관리자 요청 DTO 스키마
        │   │   └── internal/__tests__/admin-authentication.service.spec.ts — 관리자 인증 payload와 계정 상태
        │   ├── theaters/models/__tests__/seatmap.spec.ts — 좌석 수 계산과 전체 좌석 펼치기
        │   └── users/
        │       ├── __tests__/
        │       │   ├── users-pagination.spec.ts  — 사용자 목록 pagination과 필터
        │       │   └── users-write-concern-recovery.spec.ts — 사용자 생성 write concern 불확실성 복구
        │       ├── dtos/__tests__/schemas.spec.ts  — 사용자 요청 DTO 스키마
        │       └── internal/__tests__/user-authentication.service.spec.ts — 비밀번호 hash·검증과 인증 payload 상태
        └── gateway/pipes/__tests__/
            └── request-validation.pipe.spec.ts        — body·배열·중첩 요청 스키마와 오류 응답
```

## `deploy`

```text
deploy/
└── verify.sh — Compose stack build·기동, Restate recovery, API 문서 요청과 정리
```

## `libs`

```text
libs/
├── common/src/
│   ├── auth/__tests__/
│   │   ├── guards.spec.ts                    — Bearer·Basic·복합·optional 인증 guard
│   │   └── jwt-auth.service.spec.ts         — access/refresh 발급·회전·폐기·전체 logout·보안 이벤트
│   ├── cache/__tests__/cache.service.spec.ts    — Redis cache·script·lock·복구·namespace 격리
│   ├── config/__tests__/base-config.service.spec.ts — 문자열·숫자·boolean 환경 설정 조회와 오류
│   ├── date-time-range/__tests__/date-time-range.spec.ts — 날짜·시간 범위 생성과 경계 유효성
│   ├── health/__tests__/
│   │   ├── nats.health-indicator.spec.ts     — NATS health 성공·실패
│   │   └── redis.health-indicator.spec.ts    — Redis health 성공·실패
│   ├── idempotency/__tests__/errors.spec.ts     — 멱등성 오류 코드와 응답 형태
│   ├── lat-long/__tests__/lat-long.spec.ts      — 위경도 거리 계산과 HTTP 변환
│   ├── logger/__tests__/
│   │   ├── app-logger.service.spec.ts        — logger level·context·lifecycle 위임
│   │   ├── create-winston-logger.spec.ts     — Winston logger format·transport 구성
│   │   ├── exception-logger.filter.spec.ts   — HTTP·비HTTP 예외 로깅과 timing 처리
│   │   ├── redact.spec.ts                    — 민감 필드 redaction
│   │   ├── request-timing.spec.ts            — 요청 시작·종료 시간 측정
│   │   └── success-logger.interceptor.spec.ts — 성공 요청 로그와 제외 경로
│   ├── mongodb/__tests__/
│   │   ├── crud.repository.spec.ts           — Mongo CRUD repository의 초기화·쓰기·조회·삭제·pagination
│   │   └── mongo.util.spec.ts                — ObjectId·문서 mapping·query builder·Mongo 오류 helper
│   ├── nats/__tests__/
│   │   ├── nats-pubsub.service.spec.ts       — NATS publish/subscribe·소비 오류·decorator·module 등록
│   │   └── nats.module.spec.ts               — NATS connection token·registry·module 구성
│   ├── pagination/__tests__/pagination.spec.ts — pagination DTO 기본값·경계·HTTP 변환
│   ├── redis/__tests__/
│   │   ├── redis.module.cluster.spec.ts      — Redis cluster module 구성
│   │   └── redis.module.spec.ts              — standalone Redis registry와 module 구성
│   ├── s3/__tests__/s3-object.service.spec.ts  — presigned URL·메타데이터·체크섬·크기·조회·삭제
│   └── utils/__tests__/
│       ├── async.spec.ts                      — 비동기 sleep helper
│       ├── base64.spec.ts                     — Base64 인코딩·디코딩
│       ├── byte.spec.ts                       — byte 문자열 parsing·formatting과 잘못된 단위
│       ├── checksum.spec.ts                   — checksum 스키마와 파일·buffer hash
│       ├── date.schema.spec.ts                — Temporal 날짜·시간 입력 스키마
│       ├── date.spec.ts                       — 날짜 생성·변환·범위·현재 시각·덧셈·Date 경계
│       ├── env.spec.ts                        — 환경변수 문자열·숫자·boolean parsing
│       ├── http.spec.ts                       — Content-Disposition 생성과 escaping
│       ├── id.spec.ts                         — 짧은 ID 생성과 객체 ID 추출
│       ├── json.spec.ts                       — JSON parse/stringify와 Temporal·오류·특수값 변환
│       ├── lodash.spec.ts                     — 내부 lodash 대체 helper의 조회·선택·집계·비교
│       ├── path.spec.ts                       — 절대 경로·basename·dirname·파일시스템 경계
│       ├── time.spec.ts                       — 시간 단위와 millisecond 변환
│       └── validator.spec.ts                  — Require·Assume·ensure 유효성 helper
└── testing/src/
    ├── __tests__/
    │   ├── create-test-context-cleanup.spec.ts — setup 실패 시 부분 생성된 test context 정리
    │   ├── create-test-context.spec.ts         — Nest test context 생성·override·lifecycle
    │   ├── http.test-client.spec.ts           — JSON 응답·상태 코드·multipart·SSE·chain API
    │   └── utils.spec.ts                      — Temporal fixture·단계 실행·test ID·ObjectId helper
    └── vitest/__tests__/
        └── decorator-metadata.spec.ts          — Vitest 변환의 Nest DI decorator metadata 보존
```

## `tests`

```text
tests/
├── api-benchmark/
│   ├── harness-crud.js                         — CRUD 읽기·쓰기 RPS와 latency 측정
│   ├── harness-refresh.js                      — refresh token 회전 경로의 Redis·Mongo 비용 측정
│   ├── harness-user-filter.js                  — 사용자 이름 부분 검색의 collection scan 비용 측정
│   ├── mixed-runner.sh                         — 단독·혼합 부하 행렬 실행과 결과 비교
│   └── runner.sh                               — 배포 스택 기동·seed·측정·정리
├── api-race/
│   ├── jwt-refresh-race.js                     — 동일 refresh token 동시 회전의 단일 성공과 family 유지
│   ├── purchase-double-spend.js                — 동일 티켓 묶음 동시 결제의 단일 구매
│   ├── purchase-overlap-race.js                — 겹치는 티켓 구매의 원자 전이와 패자 보상
│   ├── replica-chaos.js                        — replica 중단 중 NGINX 우회와 복구 후 참여
│   ├── showtime-overlap-race.js                — 겹치는 상영 생성 workflow의 단일 성공
│   ├── sse-fanout-race.js                      — 여러 replica의 SSE client에 workflow 이벤트 전달
│   ├── ticket-holding-race.js                  — 동일 좌석 동시 선점의 단일 성공
│   ├── user-signup-race.js                     — 동일 이메일 동시 가입의 단일 생성
│   └── probes/restate-journal-recovery.js      — Restate 재시작 후 완료 step replay와 중단 step 재실행
└── web/
    ├── contracts/bff-proxy.spec.ts              — BFF Origin·Host·proxy IP 경계와 refresh 재시도 쿠키
    └── e2e/
        ├── console-auth-flow.spec.ts           — 관리자 route·역할·세션·refresh·logout 브라우저 흐름
        ├── movies-flow.spec.ts                 — 관리자의 영화·극장 관리와 사용자 삭제 브라우저 흐름
        └── user-auth-flow.spec.ts              — 사용자 로그인·개인화 홈·refresh·logout 브라우저 흐름
```
