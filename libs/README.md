# libs/ — 공유 패키지

여러 NestJS 프로젝트에서 재사용하는 패키지다. 업무 규칙과 화면·쿠키 처리는 사용하는 앱이 정한다.

## 1. 공통 코드와 테스트 도구의 위치

- `@mannercode/common`은 앱이 운영 중에 호출하는 외부 연동과 유틸리티를 제공한다. [공개 API](common/src/index.ts)
- `@mannercode/testing`은 spec·fixture에서 쓸 Nest 테스트 context와 HTTP 클라이언트를 제공한다. 앱의 개발 의존성에 둔다. [공개 API](testing/src/index.ts)
- Vitest가 라이브러리 빌드와 소스 변환 전에 불러야 하는 준비·정리 함수는 CommonJS로 제공한다. [Vitest 도우미](../tools/vitest-helpers/index.js)

Nest 모듈과 주입된 서비스를 검증할 때는 `createTestContext`, HTTP 요청까지 보낼 때는 `createHttpTestContext`를 쓴다. 생성에 성공하면 호출자가 `close()`로 앱을 닫는다. 초기화 도중 실패하면 테스트 도구가 생성한 앱을 정리하고 원래 오류를 전달한다. [초기화·종료 테스트](testing/src/__tests__/create-test-context-cleanup.spec.ts)

## 2. SDK 연결과 호출은 common에서 구현한다

common은 연결 수명과 SDK 호출을 맡고, 접속 설정·도메인 쿼리·인덱스·이벤트 내용·workflow 단계는 앱이 정한다. 앱에서 NestJS·Zod·RxJS·Express 미들웨어를 직접 쓸 수 있다. 독립 실행 스크립트는 common 빌드 없이 실행하기 위해, 테스트는 상태 확인이나 장애 재현을 위해 SDK를 직접 사용할 수 있다. [API의 SDK import 검사](../oxlint.config.mts)

common을 가져가는 프로젝트는 선언된 peer dependency를 설치한다. 특히 테스트 환경과 앱의 Nest HTTP adapter 버전을 맞춘다. Nest core가 두 번 로드되면 같은 클래스도 DI 토큰이 달라질 수 있다. [패키지 의존성](common/package.json)

### 로그인 세션에서 앱이 판단할 일

공통 인증 서비스는 서명을 확인하고 같은 로그인 세션의 갱신 토큰을 한 번만 교체한다. 비밀번호가 바뀌었거나 계정이 탈퇴했을 때 갱신을 허용할지는 사용자 도메인이 판단한다. 앱에서 `jwtService.refreshAuthTokens(refreshToken, validateSession)`을 호출하면 인증 서비스가 서명을 확인한 뒤 `validateSession(userId, claims)`를 호출한다. 검증 함수가 예외를 던지면 토큰 교체 전에 그 오류가 호출자에게 전달된다. [API의 계정 검증 함수](../apps/api/src/services/core/users/internal/user-authentication.service.ts) · [세션 검증·동시 교체 테스트](common/src/auth/__tests__/jwt-auth.service.spec.ts)

저장된 해시가 없는 계정도 비밀번호 비교를 수행하는 이유는 로그인 실패의 응답 시간 차이를 줄이기 위해서다. [비밀번호 검증 테스트](common/src/auth/__tests__/guards.spec.ts) · [Argon2id 설정](common/src/auth/password.ts) · [설정 근거](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)

### 구독·연결·락의 수명

`NatsPubSubService.subscribe()`를 기다리면 같은 subject·queue에 동시에 등록한 호출도 서버에서 구독 처리가 끝난 뒤 발행할 수 있다. 종료 시에는 이미 실행 중인 handler가 끝날 때까지 기다린다. Redis·NATS 연결을 닫다가 실패하면 `AggregateError.errors`에 원인이 남고, 다시 종료하면 실패했던 연결만 정리한다. [구독·재구독·종료 테스트](common/src/nats/__tests__/nats-pubsub.service.spec.ts) · [Redis 연결 정리](common/src/redis/__tests__/redis.module.spec.ts) · [NATS 연결 정리](common/src/nats/__tests__/nats.module.spec.ts)

`withLock`은 키가 이미 잠겨 있으면 `{ ran: false }`를 반환한다. `withLockBlocking`의 `waitMs`는 콜백을 시작할 수 있는 기한이며, 기한이 지나면 503 예외를 던진다. 시작한 작업을 끝까지 단독 실행하려면 락의 `ttlMs`를 작업의 최대 실행 시간보다 길게 잡는다. [락 경합·기한·TTL 테스트](common/src/cache/__tests__/cache.service.spec.ts)

| `CacheService`에 TTL 0을 전달하는 호출                    | 결과                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `await cache.set('key', 'value', 0)`                      | 만료 시각 없이 값을 저장한다.                                                                       |
| `await cache.incrementWithExpiry('immediate-counter', 0)` | 새 카운터는 `1`을 반환하고 즉시 만료된다. 직후 `await cache.get('immediate-counter')`는 `null`이다. |
| `await cache.withLock('job', 0, async () => null)`        | 콜백 실행 전에 `InternalServerErrorException`을 던진다.                                             |

## 3. 저장소 ID와 트랜잭션

Repository의 CRUD 메서드에는 문자열 문서 ID를 넘긴다. 직접 MongoDB 필터를 작성할 때는 `idFilter(id)`·`idsFilter(ids)`로 문서 ID를 표시한다. 일반 문자열은 집계 그룹의 `_id`로도 쓰이므로 문자열로 유지한다. CRUD 결과의 `id`는 문자열이며 projection에서 `_id`를 제외하면 생략된다. 집계 결과는 필드 이름을 유지하고 ObjectId 값만 문자열로 바꾼다. [조회·projection·집계 예제](common/src/mongodb/__tests__/crud.repository.spec.ts)

같은 트랜잭션에 참여할 Repository들에 콜백의 `TransactionContext`를 전달하고, 한 세션의 DB 작업은 순서대로 실행한다. context는 해당 콜백 실행 동안만 유효하다. 드라이버가 콜백을 재시도할 수 있으므로 S3 쓰기와 메시지 발행처럼 되돌릴 수 없는 작업은 밖에 둔다. 페이지 목록과 개수를 한 시점 기준으로 읽어야 할 때는 snapshot 트랜잭션을 사용한다. [트랜잭션 구현](common/src/mongodb/mongo-transaction.repository.ts) · [페이지 조회 테스트](common/src/mongodb/__tests__/crud.repository.spec.ts)

과반수 복제와 journal 쓰기 확인을 기다리다 `wtimeout` 오류를 받아도 쓰기가 이미 반영됐을 수 있다. 같은 쓰기를 재시도할 때는 이 가능성을 고려한다. [연결 옵션 테스트](common/src/mongodb/__tests__/connections.spec.ts)

## 4. JSON과 DTO 복원

JSON에는 날짜 타입 정보가 없으므로 DTO 스키마에서 날짜 필드를 지정한다. `JsonUtil`은 `Temporal.Instant`를 밀리초 세 자리의 UTC 문자열로, `Temporal.PlainDate`를 같은 날짜의 ISO 달력 문자열로 기록한다. 정밀도를 보존해야 하는 큰 정수는 문자열로 전송한다. [날짜와 일반 문자열의 왕복 예제](common/src/utils/__tests__/json.spec.ts) · [허용하는 날짜 입력](common/src/utils/__tests__/date.schema.spec.ts)

```ts
const date = Temporal.PlainDate.from('2023-06-18')
const json = JsonUtil.stringify({ date, title: '2023-06-18' })
const schema = z.object({ date: PlainDateFromInputSchema, title: z.string() })
const output = schema.parse(JSON.parse(json))
expect(output.date.equals(date)).toBe(true)
expect(output.title).toBe('2023-06-18')
```

Restate의 `defineWorkflow`는 입력 스키마를, `RestateWorkflowClient`는 최종 결과 스키마를 적용한다. 저장된 step 결과에서 `Temporal` 같은 타입이 필요하면 workflow 작성자가 `ctx.run`이 반환한 값을 스키마로 복원한다. [직렬화와 workflow 입력 테스트](common/src/restate/__tests__/temporal-json.serde.spec.ts) · [완료 결과 복원 테스트](common/src/restate/__tests__/workflow-client.spec.ts) · [진행 중인 작업의 버전 호환](../README.md#restate-배포-주소)

`HttpTestClient`에서 `await request.ok({ schema, expected })`를 호출하면 스키마로 변환한 본문을 `expected`와 비교한다. 반환된 응답의 `body` 타입도 스키마에서 추론한다. `await request.ok({ expected })`는 원래 JSON과 비교한다. [HTTP 응답 검증 예제](testing/src/__tests__/http.test-client.spec.ts)

## 5. SSE 이벤트를 받는 테스트 작성

`request.sse(messageHandler, errorHandler, readyHandler)`는 HTTP 200과 `Content-Type: text/event-stream`을 확인하면 `readyHandler`를 부른다. 첫 이벤트를 놓치지 않도록 이 신호를 기다린 뒤 별도 클라이언트로 발행한다. 테스트가 끝나면 `finally`에서 `request.abort()`로 구독을 닫는다. [구독·발행 예제](testing/src/__tests__/http.test-client.spec.ts)

## 6. 공통 유틸의 입력·반환 규칙

- `await PathUtil.move(src, dest)`로 파일 시스템을 넘어 디렉터리를 옮길 때 대상에 동명 파일이 있으면 예외를 던지고 양쪽 파일을 보존한다. `PathUtil.exists`는 접근이 거부되면 오류를 호출자에게 전달한다. [파일 이동과 경로 조회](common/src/utils/__tests__/path.spec.ts)
- `assignIfDefined(target, source, 'name')`은 `source.name`이 `undefined`면 기존 값을 유지하고, `null`이면 `target.name`에 `null`을 쓴다. [필드 매핑](common/src/mongodb/__tests__/mongo.util.spec.ts)

## 7. TypeScript 작성 규칙

객체·유니온은 `type`, 클래스가 구현할 계약이나 선언 병합은 `interface`를 쓴다. 파일 경로 변수는 `Path`, 디렉터리 경로 변수는 `Dir`로 끝낸다.

같은 디렉터리의 파일은 `./파일.js`로 가져온다. 패키지 내부에서 다른 모듈을 참조할 때 common은 `#common/모듈명`으로 그 모듈의 `index`를 읽는다. 캐시 서비스의 선언은 `import type { RedisConnection } from '#common/redis'`다. 단일 파일로 구성한 모듈도 `#common/transaction`처럼 이름으로 참조한다. 각 라이브러리 테스트에서 패키지 진입점이 필요하면 `#common` 또는 `#testing`을 사용하고, 다른 패키지에서 가져올 때는 `@mannercode/common` 또는 `@mannercode/testing`을 쓴다. [캐시 서비스](common/src/cache/cache.service.ts) · [common의 내부 경로](common/package.json) · [testing의 내부 경로](testing/package.json)

라이브러리의 타입 검사와 소스 테스트는 `nest-seed-source` 조건으로 `src`의 TypeScript를 읽고, 빌드한 패키지를 실행하는 Node는 기본 경로인 `_output/dist`의 JavaScript를 읽는다. 타입 전용 참조는 `import type`으로, Nest가 생성자에서 DI 토큰으로 사용할 클래스는 값으로 가져온다. ESM 패키지에서 CommonJS로 실행할 도구는 `.cjs`를 쓴다. [라이브러리 컴파일 설정](common/tsconfig.json) · [생성자 타입 메타데이터 테스트](testing/src/vitest/__tests__/decorator-metadata.spec.ts)
