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
- [x] libs/common/src/auth/auth.guard.ts:109 — 만료 사전 디코드 분기를 제거해 모든 인증 실패가 설정된 errorBody로 401 응답(verifyAsync가 만료도 검출)

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

- [x] apps/api/src/services/application/recommendation/recommendation.service.ts:32 — 페이지 기본값·상한 분리로 결합 해소(RECENT_WATCH_LIMIT 정책 상수 + 상한 100 이내 주석)
- [x] libs/common/src/mongoose/crud.repository.ts:116 — HTTP_PAGINATION_MAX_SIZE(기본 100) 신설로 기본값과 상한을 분리. CrudRepository가 (defaultSize, maxSize)를 따로 받아, 기본값을 낮춰도 console·perf·e2e의 size=50 요청이 깨지지 않음
- [x] apps/api/src/services/view/user-app/home/home-view.service.ts:36 — 홈 후보를 최신 개봉작 순으로 고정해 결정적으로 만들고, "최신 개봉작 중 지금 볼 수 있는 영화" 큐레이션임을 주석으로 명시

### 운영 가시성

- [x] apps/api/src/modules/health/health.service.ts:22 — NatsHealthIndicator(flush 왕복)·TemporalHealthIndicator(gRPC health check)를 신설해 /health가 4개 인프라를 모두 점검
- [x] libs/common/src/redis/redis.module.ts:48 — Redis/NatsConnectionRegistry를 추가해 모듈이 만든 연결을 onModuleDestroy에서 quit/drain. 테스트 픽스처들의 수동 정리(이중 종료) 7곳도 모듈 책임으로 단순화

### 테스트 인프라

- [x] tools/jest-helpers/index.js:162 — cleanupRedisAll이 Cluster ready를 기다린 뒤 nodes('master')를 조회하고, 정리 대상 0개면 예외를 던지도록 수정 완료(무음 no-op 차단)
- [x] tests/api-perf/perf-common.js:75 — setup이 있는 하네스(refresh·user-filter)는 startAt을 setup() 끝에서 계산해 반환값으로 내려보내도록 수정 완료. setup 없는 harness-crud는 현행 유지(문서화)

### 문서

- [x] docs/testing.md:121 — 문서가 설명하는 api-docs spec 문법(DOC/GROUP)이 run.sh에 존재하지 않음 → 실제 문법(`TEST "<설명>" <상태> <METHOD> <경로>`, 그룹은 파일명 자동 유도)으로 갱신 완료. 단일 spec 실행법도 §4·§5에 추가

## 낮음 (52)

### libs/common 동작 결함

- [x] libs/common/src/config/base-config.service.ts:35 — getNumber가 빈 문자열을 명시적으로 거절(테스트 추가)
- [x] libs/common/src/logger/redact.ts:32 — plain object가 아닌 값(Date 등)은 그대로 통과(테스트 추가)
- [x] libs/common/src/utils/json.ts:69 — quoteIntegers를 문자열 구간을 건너뛰는 토크나이저로 교체(테스트 추가)
- [x] libs/common/src/utils/byte.ts:10 — toString을 공백 구분·토큰별 부호로 바꿔 fromString과 왕복 성립(왕복 테스트 추가)
- [x] libs/common/src/pagination/pagination.ts:69 — page/size에 @IsInt 추가
- [x] libs/common/src/mongoose/crud.repository.ts:235 — commit/abort 실패에도 endSession이 호출되도록 중첩 finally
- [x] libs/common/src/mongoose/crud.repository.ts:149 — countDocuments에 session 전달

### API

- [x] apps/api/src/services/gateway/movies.http-controller.ts:56 — 공개 GET은 MoviesService.getPublished로 draft를 404로 숨김(내부 흐름은 getMany 유지). draft 404 테스트 추가, assets 스펙은 서비스 조회로 전환
- [ ] apps/api/src/services/infrastructure/assets/assets.service.ts:136 — checksum을 필수로 받고 저장·노출하지만 업로드 결과와 대조하지 않음
- [x] apps/api/src/config/app-config.service.ts:99 — 기본값·상한 이중 역할을 HTTP_PAGINATION_MAX_SIZE 분리로 해소(위 crud.repository 항목과 같은 커밋)
- [x] apps/api/src/config/app-config.service.ts:9 — AUTH 시크릿 4종 min(20), ROOT_PASSWORD min(8) 추가
- [x] apps/api/src/services/core/users/users.repository.ts:37 — existsByEmail 죽은 코드 제거 완료(자기 자신만 검증하던 테스트 포함)
- [x] apps/api/src/services/application/showtime-creation/internal/types.ts:15 — ShowtimeCreationJobData 제거 완료

### 통합 테스트 (apps/api)

- [x] `apps/api/src/__tests__/integration/application/showtime-creation.utils.ts:11` — waitForCompletion이 스트림 전용 HttpTestClient를 생성해 abort가 항상 SSE 구독을 가리키도록 수정 완료
- [x] `apps/api/src/__tests__/integration/core/users.spec.ts:96` — rejects.not.toBeInstanceOf(ConflictException)로 변환 부재까지 검증(admins 동일 테스트도 함께) 완료
- [x] `apps/api/src/__tests__/integration/core/admin-management.spec.ts:105` — username만 틀린 케이스가 실제 rootPassword 변수를 쓰도록 수정 완료
- [x] `apps/api/src/__tests__/integration/helpers/create-app-test-context.ts:69` — createConfigServiceMock 제거 완료
- [x] `apps/api/src/__tests__/integration/application/purchase.utils.ts:47` — 선점 범위를 반환값(heldTickets 4장)과 일치시킴 완료

### 테스트 라이브러리·헬퍼

- [x] libs/testing/src/http.test-client.ts:161 — sse를 버퍼 기반으로 재작성: 청크를 모아 `\n\n` 단위로 분할 전달, 한 청크 다중 이벤트도 모두 처리. 픽스처 events를 3연속 발행으로 확장하고 스펙 테스트 추가
- [x] libs/testing/src/http.test-client.ts:21 — quoteUnsafeIntegers를 문자열 구간을 건너뛰는 토크나이저로 재작성(libs/common JsonUtil과 동일 패턴). 문자열 내 숫자 보존 테스트 추가
- [x] libs/testing/src/http.test-client.ts:174 — 죽은 streamError 분기 제거, 'end'에서 구분자 없이 끝난 잔여 본문(404 JSON 등)을 errorHandler로 flush하도록 수정. 비-SSE 본문 테스트 추가
- [x] libs/testing/src/create-test-context.ts:44 — ignoreProviders 옵션·NullProvider 제거 완료
- [x] libs/testing/src/utils.ts:25 — createDummyFile 제거 완료(자체 테스트 포함)
- [x] `libs/testing/src/__tests__/http.test-client.fixture.ts:61` — 미사용 HTTP 엔드포인트 6종(items×3·search·echo-headers·payload-too-large) 제거 완료. SSE 픽스처(events 등)는 sse 버그 수정·테스트 추가 시 쓰일 발판이라 유지 — sse 미검증 문제는 http.test-client의 sse 버그 항목들과 함께 처리
- [x] tools/jest-helpers/index.js:104 — setupJestLifecycle afterAll이 옵셔널 체이닝으로 정의된 핸들만 정리하도록 수정(beforeAll 실패 원인을 TypeError로 가리지 않음)
- [x] apps/api/webpack.config.js:28 — externals 주석이 존재한 적 없는 payloadConverterPath를 근거로 설명. 조사 결과 temporal-sandbox는 워크플로 파일에서만 import되고 워크플로는 bundleWorkflowCode가 따로 번들하므로 앱 번들 그래프에 들어오지 않음(산출물 참조 0건) → 죽은 external 규칙째 제거 완료, 빌드 검증
- [x] libs/temporal-sandbox/package.json:20 — 미사용 @mannercode/dev-tools devDependency 제거 완료

### 데모 앱 (console·user-app)

- [x] apps/user-app/src/app/page.tsx:34 — 게스트 읽기 데모이므로 개인화를 약속하는 문구를 제거하고 경계를 주석으로 명시 완료
- [x] apps/console/src/app/theaters/page.tsx:12 — 홈에 '극장 목록' 링크를 추가해 도달 가능하게 함(/users 목록 링크와 같은 패턴)
- [x] apps/console/src/lib/session.ts:20 — readEmail·EMAIL_KEY 제거 완료(saveSession 시그니처도 토큰만 받게 축소)
- [x] apps/console/src/app/login/page.tsx:43 — 가입 페이지가 없는 실제 이유(root가 POST /admins로 생성)로 문구 수정 완료

### 테스트 스위트 (perf·race·e2e)

- [x] tests/api-race/ticket-holding-race.js:72 — `?? at(-1)` 폴백을 두 파일 모두 명시적 실패로 교체 완료
- [x] tests/api-perf/harness-refresh.js:5 — 주석을 실제 구현(왕복 4회, 명령 8개)에 맞게 수정 완료
- [x] tests/api-race/race-common.js:15 — SERVER_URL 미설정 시 http://localhost:3000 폴백 — race 시나리오는 4-replica 배포 스택 전제인데 단일 dev 서버를 조용히 때려 결과가 왜곡됨 → 필수값으로 수정 완료 (perf 하네스의 동일 기본값은 수동 단독 실행이 1차 용도라 의도된 것)

### 인프라·CI

- [x] .github/workflows/test-stability.yaml:12 — cancel-in-progress: false로 변경(직전 회차 보존, 새 회차는 대기)
- [x] infra/compose.mongo.yml:68 — 대기 조건을 db.hello().isWritablePrimary로 교체해 실제 PRIMARY 선출을 기다림
- [x] infra/temporal/scripts/create-namespace.sh:6 — `DEFAULT_NAMESPACE`·`TEMPORAL_ADDRESS`의 `:-` 폴백이 compose 배선 누락을 가림(엉뚱한 'default' 네임스페이스를 만들고 API는 나중에 혼란스럽게 실패) → `:?`로 수정 완료. 정의처 없는 죽은 노브(`TEMPORAL_HEALTH_CHECK_*`, `TEMPORAL_NAMESPACE_RETENTION`)도 상수로 교체
- [x] infra/temporal/scripts/create-namespace.sh:16 — 대기 루프 3중(nc 포트 → cluster health → namespace 재시도) 중 nc 포트 대기는 health 루프가 같은 실패를 같은 예산으로 처리하므로 중복 → 제거 완료
- [x] apps/api/api-docs/run.sh:189 — `${CURRENT_GROUP:-일반}` 폴백이 spec 밖 TEST 호출이라는 버그를 '일반' 그룹으로 위장 → `:?`로 수정 완료. api-docs/.env의 SERVER_URL 기본값도 `${API_PORT:?}` 연동 완료
- [x] apps/api/api-docs/run.sh:7 — 미사용 죽은 변수 PURPLE 제거 완료. 색상 출력 자체는 사용자가 직접 읽는 산출물이라 유지하기로 결정(2026-06-10)
- [x] .env.infra:1 — minio(RELEASE.2025-09-07), aws-cli(2.35.2), nginx(1.31-alpine)로 버전 고정 완료(Docker Hub에서 태그 존재 확인)
- [x] .env.infra:29,33 — NATS_MONITORING_PORT·TEMPORAL_DB_PORT가 어디서도 읽히지 않는 죽은 변수. 실제 값은 infra/compose.nats.yml(8222 하드코딩 3곳)과 infra/temporal/compose.temporal.yml:36,53(DB_PORT '5432')에 박혀 있어 .env.infra 값을 바꿔도 효과 없음 → 제거 완료(서비스 내부 전용 값이라 env에 둘 이유 없음)
- [x] deploy/deps.Dockerfile:10 — apps/user-app/package.json 복사 추가로 주석의 전제와 일치
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
