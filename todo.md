# 전체 검토 결과 TODO

2026-06-10 전수 검토 결과. 파인더 15개(영역 11 + 횡단 4)가 보고한 102건을 중복 병합(87건) 후
적대 검증을 거쳐 **82건 확정**(높음 8 / 중간 22 / 낮음 52), 16건은 의도된 설계로 판명되어 기각.
(2026-06-10 설정·폴백·스크립트 과잉 후속 검토에서 낮음 6건 추가)

전반: SoLA 레이어 의존 위반 0건(eslint-plugin-boundaries로 강제), 빌드·린트 클린.
결함은 인증 수명주기, 티켓 판매 동시성, 도메인 간 참조 무결성 세 축에 집중.

## 높음 (8)

### 인증·계정

- [x] apps/api/src/services/core/users/users.service.ts:41 — 계정 삭제가 리프레시 토큰 패밀리를 취소하지 않던 문제 → deleteMany·admins.remove가 삭제 전에 revokeAllForUser/revokeAllForAdmin을 호출하도록 수정 완료(통합 테스트 3건 추가). 액세스 토큰 잔여 수명(30m) 창은 시드의 의도된 트레이드오프로 둠
- [x] apps/api/src/services/core/users/users.repository.ts:72 — PATCH /users의 password가 조용히 버려지던 문제 → admins와 같은 패턴(해시 저장 + 기존 리프레시 토큰 회수)으로 지원 완료, 테스트 2건 추가

### 티켓 판매 흐름

- [x] apps/api/src/services/application/booking/booking.service.ts:40 — 티켓 선점 검증 추가 완료: 수량은 구매 상한(maxPerPurchase) 적용(400), 존재하지 않는 티켓은 404, 다른 상영의 티켓은 400. 테스트 3건 추가
- [x] apps/api/src/services/application/purchase/purchase.service.ts:31 — 겹치는 묶음의 동시 결제 이중 판매 → 이중 판매 방지를 락이 아니라 `transitStatusMany`의 원자 전이(트랜잭션 + from 상태 조건, 전부-아니면-전무)가 보장하도록 수정 완료. 락은 동일 묶음 직렬화 최적화로 유지(주석 명시)
- [x] apps/api/src/services/application/purchase/internal/ticket-purchase.service.ts:52 — rollbackPurchase의 무차별 복구 → 메서드 제거. completePurchase가 원자 전이 성공("소유")을 근거로 이벤트 발행 실패 시에만 자기 티켓을 from=Sold 조건으로 되돌림. 발행된 적 없는 canceled 이벤트·구독 코드도 함께 정리
- [x] apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts:53 — 요청 내부 startTimes 중복·상호 겹침 → 사가 시작 전 진입점(requestShowtimeCreation)에서 정렬 후 인접 간격 < 상영 길이면 400으로 거절. 테스트 2건 추가

### 참조 무결성·수명주기

- [x] apps/api/src/services/core/movies/movies.service.ts:61 — 상영이 남은 영화·극장 삭제 시 dangling 참조 문제 → 게이트웨이 DELETE 핸들러가 ShowtimesService.existsByMovieIds/existsByTheaterIds로 확인 후 409(ERR_MOVIE_HAS_SHOWTIMES / ERR_THEATER_HAS_SHOWTIMES)로 거부하도록 수정 완료. 같은 계층(core)끼리는 참조 불가라 소비자(게이트웨이) 조합으로 구현(architecture.md 규칙 3). 테스트 2건 추가, 전체 스위트(265개) 통과
- [x] libs/common/src/temporal/temporal-worker.service.ts:38 — 이미 멈춘 워커의 `shutdown()` IllegalStateError → SDK와 같은 방식으로 IllegalStateError 한정 가드 + `connection.close()`를 finally로 이동 완료. 멈춘 워커 재destroy 테스트 추가

## 중간 (22)

### 판매 동시성·사가

- [x] apps/api/src/services/core/tickets/tickets.service.ts:50 — updateStatusMany의 검사-후-쓰기 경쟁 → transitStatusMany(트랜잭션 내 조건부 updateMany, matchedCount 검증)로 교체 완료. 전부-아니면-전무 테스트 추가
- [x] apps/api/src/services/core/ticket-holding/ticket-holding.service.ts:86 — releaseTickets는 무소유 DEL 결함 + 프로덕션 미사용이라 제거(보유는 TTL 만료·재선점 정리로 충분). hold 스크립트의 낡은 주석도 현행화
- [x] apps/api/src/services/application/showtime-creation/worker/activities.ts:76 — compensate가 보상 실패를 삼키던 문제 → 실패를 던져 Temporal 재시도 정책(3회)이 실제로 동작하게 수정, 재시도 테스트 추가(삭제는 멱등)
- [x] apps/api/src/services/application/showtime-creation/worker/workflow.ts:42 — 좀비 validateAndCreate와 compensate의 경합 → compensate가 같은 분산 락을 기다려 직렬화. 락 TTL도 액티비티 타임아웃과 같은 15분으로 정합(워커 사망 시에만 만료)

### 인증·세션

- [x] apps/api/src/services/core/admins/admins.service.ts:39 — admin 비밀번호 변경 시 기존 리프레시 토큰 패밀리 회수 추가 완료(같은 권한 회수 커밋에 포함)
- [ ] libs/common/src/auth/auth.guard.ts:109 — 만료된 토큰의 401 응답만 설정된 errorBody(에러 code)를 우회

### 데이터 모델

- [x] apps/api/src/services/core/users/models/user.ts:10 — (email, deletedAt) 복합 유일 인덱스로 교체해 살아 있는 문서끼리만 충돌, 탈퇴 이메일 재가입 테스트 추가
- [x] apps/api/src/services/core/admins/models/admin.ts:7 — Admin도 동일하게 수정, 재생성 테스트 추가
- [x] libs/common/src/mongoose/append-only.schema.ts:28 — findOneAndDelete(쿼리)·bulkWrite(모델) 미들웨어 차단 추가, 테스트 2건 추가

### 입력 검증·API 계약

- [x] apps/api/src/services/application/purchase/purchase.service.ts:56 — 가격 정의처를 서버로 이동: 도메인 정책 `TICKET_PRICE`(config 기본 10000)로 합산 검증, 불일치 시 400. 테스트·race 스크립트 동기화
- [x] apps/api/src/services/application/purchase/dtos/create-purchase.dto.ts:9 — @IsNotEmpty → @ArrayNotEmpty로 빈 배열 거절
- [x] libs/common/src/mongoose/mongoose.util.ts:7 — objectId()가 형식 검증 후 400(ERR_MONGOOSE_INVALID_OBJECT_ID)을 던지도록 수정
- [x] libs/common/src/pagination/pagination.ts:40 — orderby 객체 입력의 {name, direction} 모양 검증, 배열·임의 객체는 400
- [x] libs/common/src/utils/http.ts:12 — filename\*의 공백을 RFC 5987대로 %20으로 유지(+ 치환 제거), 테스트 3건 갱신

### 숨은 설정 결합

- [ ] apps/api/src/services/application/recommendation/recommendation.service.ts:32 — 관람기록 조회 size 50 하드코딩이 HTTP_PAGINATION_DEFAULT_SIZE(=50)와 일치할 때만 동작, env를 낮추면 추천이 400
- [ ] libs/common/src/mongoose/crud.repository.ts:116 — HTTP_PAGINATION_DEFAULT_SIZE를 50 미만으로 낮추면 console 두 페이지·perf 5개 시나리오·console-e2e가 동시에 400으로 깨지는 숨은 결합
- [ ] apps/api/src/services/view/user-app/home/home-view.service.ts:36 — 홈 후보 영화를 정렬 없는 첫 페이지 12개로 선정해 상영 중 영화 누락·비결정적 결과

### 운영 가시성

- [ ] apps/api/src/modules/health/health.service.ts:22 — /health가 NATS·Temporal 연결을 점검하지 않아 핵심 기능이 죽어도 healthy로 보고
- [ ] libs/common/src/redis/redis.module.ts:48 — RedisModule·NatsModule이 만든 연결을 닫는 수명주기 훅이 없어 app.close() 후 연결 잔류

### 테스트 인프라

- [ ] tools/jest-helpers/index.js:162 — cleanupRedisAll이 Cluster 연결 준비 전에 nodes('master')를 호출해 Redis flush가 항상 no-op(실행으로 재현됨). 정리 대상 0개면 예외를 던져 무음 통과 차단 권장
- [ ] tests/api-perf/perf-common.js:75 — 측정 창 시작점이 VU init 시각 기준이라 setup(bcrypt 가입·로그인)이 워밍업을 잠식, RPS 최대 ~10% 과대. 측정 시작점을 setup() 완료 기준으로 이동

### 문서

- [x] docs/testing.md:121 — 문서가 설명하는 api-docs spec 문법(DOC/GROUP)이 run.sh에 존재하지 않음 → 실제 문법(`TEST "<설명>" <상태> <METHOD> <경로>`, 그룹은 파일명 자동 유도)으로 갱신 완료. 단일 spec 실행법도 §4·§5에 추가

## 낮음 (52)

### libs/common 동작 결함

- [ ] libs/common/src/config/base-config.service.ts:35 — getNumber: 빈 문자열 환경 변수가 예외 대신 0으로 통과
- [ ] libs/common/src/logger/redact.ts:32 — redactSensitive가 Date 등 plain object가 아닌 값을 {}로 바꿔 로그에서 값 소실
- [ ] libs/common/src/utils/json.ts:69 — JsonUtil.parse가 문자열 리터럴 내부의 숫자까지 치환해 유효한 JSON 파싱 실패
- [ ] libs/common/src/utils/byte.ts:10 — ByteUtil.toString 출력을 fromString이 거부(왕복 불가, TimeUtil과 불일치)
- [ ] libs/common/src/pagination/pagination.ts:69 — page/size에 @IsInt가 없어 소수 값 통과, 페이지 경계 비결정적
- [ ] libs/common/src/mongoose/crud.repository.ts:235 — withTransaction: commit/abort 실패 시 endSession 미호출로 세션 누수
- [ ] libs/common/src/mongoose/crud.repository.ts:149 — findWithPagination 카운트 쿼리가 session을 무시해 트랜잭션 내 조회 불일치

### API

- [ ] apps/api/src/services/gateway/movies.http-controller.ts:56 — 비공개(draft) 영화가 가드 없는 GET /movies/:movieId로 조회됨
- [ ] apps/api/src/services/infrastructure/assets/assets.service.ts:136 — checksum을 필수로 받고 저장·노출하지만 업로드 결과와 대조하지 않음
- [ ] apps/api/src/config/app-config.service.ts:99 — HTTP_PAGINATION_DEFAULT_SIZE가 기본값이 아니라 페이지 크기 상한으로도 동작
- [ ] apps/api/src/config/app-config.service.ts:9 — JWT·root 시크릿에 최소 길이 검증이 없음
- [x] apps/api/src/services/core/users/users.repository.ts:37 — existsByEmail 죽은 코드 제거 완료(자기 자신만 검증하던 테스트 포함)
- [x] apps/api/src/services/application/showtime-creation/internal/types.ts:15 — ShowtimeCreationJobData 제거 완료

### 통합 테스트 (apps/api)

- [ ] `apps/api/src/__tests__/integration/application/showtime-creation.utils.ts:11` — waitForCompletion의 abort가 SSE 스트림이 아니라 마지막 요청(POST)을 겨냥
- [ ] `apps/api/src/__tests__/integration/core/users.spec.ts:96` — "ConflictException으로 바꾸지 않고 그대로 던진다" 테스트가 변환 여부를 전혀 검증하지 못함
- [ ] `apps/api/src/__tests__/integration/core/admin-management.spec.ts:105` — RootAuthGuard username 검증 테스트가 dev용 ROOT_PASSWORD 값에 암묵적 결합
- [x] `apps/api/src/__tests__/integration/helpers/create-app-test-context.ts:69` — createConfigServiceMock 제거 완료
- [ ] `apps/api/src/__tests__/integration/application/purchase.utils.ts:47` — holdTickets가 반환하는 heldTickets(4장)와 실제 선점 범위(10장 전부)가 다름

### 테스트 라이브러리·헬퍼

- [ ] libs/testing/src/http.test-client.ts:161 — sse: 한 청크에 이벤트가 여러 개 오면 마지막만 전달되고 앞 이벤트 소실
- [ ] libs/testing/src/http.test-client.ts:21 — quoteUnsafeIntegers가 문자열 리터럴 내부의 긴 숫자도 quoting해 유효한 JSON 파싱이 깨짐
- [ ] libs/testing/src/http.test-client.ts:174 — sse 'end' 핸들러: Node 스트림 'end' 이벤트는 인자가 없어 streamError 분기가 절대 실행 안 됨
- [x] libs/testing/src/create-test-context.ts:44 — ignoreProviders 옵션·NullProvider 제거 완료
- [x] libs/testing/src/utils.ts:25 — createDummyFile 제거 완료(자체 테스트 포함)
- [x] `libs/testing/src/__tests__/http.test-client.fixture.ts:61` — 미사용 HTTP 엔드포인트 6종(items×3·search·echo-headers·payload-too-large) 제거 완료. SSE 픽스처(events 등)는 sse 버그 수정·테스트 추가 시 쓰일 발판이라 유지 — sse 미검증 문제는 http.test-client의 sse 버그 항목들과 함께 처리
- [ ] tools/jest-helpers/index.js:104 — setupJestLifecycle: beforeAll 실패 시 afterAll이 undefined 핸들에 close/destroy를 호출해 원인 파악 방해
- [x] apps/api/webpack.config.js:28 — externals 주석이 존재한 적 없는 payloadConverterPath를 근거로 설명. 조사 결과 temporal-sandbox는 워크플로 파일에서만 import되고 워크플로는 bundleWorkflowCode가 따로 번들하므로 앱 번들 그래프에 들어오지 않음(산출물 참조 0건) → 죽은 external 규칙째 제거 완료, 빌드 검증
- [x] libs/temporal-sandbox/package.json:20 — 미사용 @mannercode/dev-tools devDependency 제거 완료

### 데모 앱 (console·user-app)

- [ ] apps/user-app/src/app/page.tsx:34 — 로그인 후 "회원님을 위한 추천"을 표시하지만 토큰을 보내지 않아 개인화 추천이 절대 동작하지 않음
- [x] apps/console/src/app/theaters/page.tsx:12 — 홈에 '극장 목록' 링크를 추가해 도달 가능하게 함(/users 목록 링크와 같은 패턴)
- [x] apps/console/src/lib/session.ts:20 — readEmail·EMAIL_KEY 제거 완료(saveSession 시그니처도 토큰만 받게 축소)
- [ ] apps/console/src/app/login/page.tsx:43 — "시드된 1명으로만 동작" 문구가 실제 동작(부팅 시 admin 미생성)과 불일치

### 테스트 스위트 (perf·race·e2e)

- [ ] tests/api-race/ticket-holding-race.js:72 — `?? search.body.at(-1)` 폴백이 startTime 매칭 실패를 침묵시킴 (purchase-double-spend.js:74도 동일 패턴)
- [ ] tests/api-perf/harness-refresh.js:5 — 주석의 "호출마다 Redis를 두 번 친다"가 실제 구현(4 round-trip, 8개 명령)과 불일치
- [x] tests/api-race/race-common.js:15 — SERVER_URL 미설정 시 http://localhost:3000 폴백 — race 시나리오는 4-replica 배포 스택 전제인데 단일 dev 서버를 조용히 때려 결과가 왜곡됨 → 필수값으로 수정 완료 (perf 하네스의 동일 기본값은 수동 단독 실행이 1차 용도라 의도된 것)

### 인프라·CI

- [ ] .github/workflows/test-stability.yaml:12 — cancel-in-progress가 6시간 주기와 350분 실행 시간 사이에서 직전 회차를 취소할 수 있음
- [ ] infra/compose.mongo.yml:68 — mongo-setup 대기 루프가 PRIMARY 선출이 아니라 rs.status().ok만 검사해 사실상 무대기
- [x] infra/temporal/scripts/create-namespace.sh:6 — `DEFAULT_NAMESPACE`·`TEMPORAL_ADDRESS`의 `:-` 폴백이 compose 배선 누락을 가림(엉뚱한 'default' 네임스페이스를 만들고 API는 나중에 혼란스럽게 실패) → `:?`로 수정 완료. 정의처 없는 죽은 노브(`TEMPORAL_HEALTH_CHECK_*`, `TEMPORAL_NAMESPACE_RETENTION`)도 상수로 교체
- [x] infra/temporal/scripts/create-namespace.sh:16 — 대기 루프 3중(nc 포트 → cluster health → namespace 재시도) 중 nc 포트 대기는 health 루프가 같은 실패를 같은 예산으로 처리하므로 중복 → 제거 완료
- [x] apps/api/api-docs/run.sh:189 — `${CURRENT_GROUP:-일반}` 폴백이 spec 밖 TEST 호출이라는 버그를 '일반' 그룹으로 위장 → `:?`로 수정 완료. api-docs/.env의 SERVER_URL 기본값도 `${API_PORT:?}` 연동 완료
- [x] apps/api/api-docs/run.sh:7 — 미사용 죽은 변수 PURPLE 제거 완료. 색상 출력 자체는 사용자가 직접 읽는 산출물이라 유지하기로 결정(2026-06-10)
- [ ] .env.infra:1 — minio/minio:latest, amazon/aws-cli(무태그), nginx:alpine만 버전 미고정
- [x] .env.infra:29,33 — NATS_MONITORING_PORT·TEMPORAL_DB_PORT가 어디서도 읽히지 않는 죽은 변수. 실제 값은 infra/compose.nats.yml(8222 하드코딩 3곳)과 infra/temporal/compose.temporal.yml:36,53(DB_PORT '5432')에 박혀 있어 .env.infra 값을 바꿔도 효과 없음 → 제거 완료(서비스 내부 전용 값이라 env에 둘 이유 없음)
- [ ] deploy/deps.Dockerfile:10 — apps/user-app/package.json을 복사하지 않아 주석의 전제와 모순
- [x] eslint.config.node.js:139 — 미사용 export 4종(tseslint, basePlugins, baseRules, escapeForRegex)을 내부 전용으로 격하 완료
- [x] package-lock.json:8 — license 동기화 1줄, temporal-sandbox 의존성 정리와 함께 커밋 완료

### 문서 표류

- [x] docs/environment.md:12 — .env.api 표의 'test.sh·runner.sh가 source' 설명 제거 완료(둘 다 ambient 상속)
- [x] docs/testing.md:102 — 'apps/api jest.global.js가 .env 로드' 설명을 실제(workflow bundle 생성만, env는 ambient)로 수정 완료
- [x] README.md:26 — '단일 spec 실행법'을 docs/testing.md §4에 추가해(`npm test -w apps/api -- <패턴> --coverage=false`, 동작 확인) 안내가 유효해짐
- [x] docs/conventions.md:59 — workflowBundle 경로 예시를 실제 경로(`_output/workflows/showtime-creation/workflow.js`)로 수정 완료
- [x] apps/api/jest.teardown.js:27 — 미정의 REDIS_HOST4~6/REDIS_PORT4~6 참조 제거 완료
- [x] docs/decisions.md:110 — user-app 홈 View 예시에 Recommendation(Application) 호출 추가 완료
- [x] docs/architecture.md:63 — 강제 수단을 eslint-plugin-boundaries(방향)+no-restricted-imports(세부)로 정정 완료

## 기각된 지적 — 의도된 설계로 판명 (재지적 금지)

검증 과정에서 반박되어 기각된 15건 중 다시 제기될 가능성이 높은 것들:

- watch-records 생성 경로 0개("죽은 기능") — 커밋 6d011ea와 api-client.ts 주석으로 확인된 의도된 시드 경계. 게스트는 개봉일 순 폴백으로 정상 동작
- NATS 핸들러 예외 시 구독 루프 중단 — 클래스 주석과 전용 테스트로 명시된 계약. 발행자가 모두 같은 앱이라 잘못된 메시지 경로 없음
- test-atoz에 Docker Hub 로그인 부재 — 커밋 9a9b2b7의 의도적 결정. fork PR에는 secrets가 없어 무조건적 로그인이 오히려 PR을 깨뜨림
- purchase tryCompensate의 보상 실패 삼킴(purchase.service.ts:100) — 바로 위 주석(86-88행)이 설계를 명시: 보상 한 단계가 실패해도 나머지 단계를 계속 시도하고, 실패는 운영자용 error 로그로 남기며, 원래 오류는 호출자에게 그대로 전파된다(은폐 아님). 강한 정합성이 필요하면 Temporal 사가를 쓰라고 문서화됨
- 기타: perf 하네스의 무단언 종료, mixed-runner의 set -e 동작, .husky 전역 commitlint, SSE 구독 순서 경합 2건, conventions.md REST 예시 등 — 모두 검증자가 코드·커밋 근거로 반박
