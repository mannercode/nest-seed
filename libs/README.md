# 공유 라이브러리

- `@mannercode/common`은 MongoDB·Redis·NATS·S3·Restate 연결과 SDK 호출을 맡는다. 접속 설정과 도메인 쿼리·인덱스·이벤트 내용·workflow 단계는 앱이 정한다. [공개 API](common/src/index.ts)
- `@mannercode/testing`은 Nest 테스트 앱과 HTTP 클라이언트를 제공한다. 사용하는 앱의 개발 의존성에 둔다. [공개 API](testing/src/index.ts)

다른 프로젝트에서 가져갈 때는 패키지에 선언된 peer dependency를 설치하고 앱과 테스트의 Nest 버전을 맞춘다. Nest core를 두 번 로드하면 같은 클래스도 서로 다른 DI 토큰이 될 수 있다. [common 의존성](common/package.json) · [testing 의존성](testing/package.json)

연결 설정을 다른 Nest 모듈에서 가져오려면 `forRootAsync`나 `register`의 `imports`에 해당 모듈을, `inject`에 그 모듈이 export한 토큰을 넣는다. [S3 설정 주입 예제](common/src/s3/__tests__/s3-object.service.spec.ts)

`MongoConnection.connect`, `createTestContext`, `createHttpTestContext`의 초기화나 `withTransaction`의 트랜잭션이 실패하고 자원 정리도 실패하면 `SuppressedError.suppressed`에 원래 오류가, `error`에 정리 오류가 담긴다. [MongoDB 연결](common/src/mongodb/__tests__/connections.spec.ts) · [트랜잭션](common/src/mongodb/__tests__/crud.repository.spec.ts) · [Nest 테스트 앱](testing/src/__tests__/create-test-context-cleanup.spec.ts)

## 저장소와 트랜잭션

`MongoDocumentRepository`는 연결과 컬렉션 이름으로 생성한다. `findWithPagination()`을 쓰는 저장소는 `CrudRepository`를 상속하고 생성자에 페이지 기본 크기와 상한을 지정한다. [작업 저장소](../apps/api/src/services/infrastructure/job-demo/job-demo.repository.ts) · [페이지 조회 저장소](common/src/mongodb/__tests__/crud.repository.fixture.ts)

CRUD 메서드에는 문자열 문서 ID를 넘긴다. MongoDB 필터를 직접 쓸 때는 `idFilter(id)`·`idsFilter(ids)`로 문서 ID를 표시한다. 집계 그룹의 `_id`에는 일반 문자열도 들어갈 수 있기 때문이다. CRUD 결과는 `id`를 반환하고, projection으로 `_id`를 빼면 `id`도 생략한다. 집계 결과는 필드 이름을 보존하고 ObjectId 값만 문자열로 바꾼다. 저장소에 기본 projection을 두면 `MongoDocumentRepository<User, typeof userProjection>`처럼 타입을 함께 지정한다. [저장소 조회 예제](common/src/mongodb/__tests__/crud.repository.spec.ts)

한 트랜잭션에 참여하는 Repository에는 콜백의 `TransactionContext`를 전달하고 같은 세션의 작업을 순서대로 실행한다. context는 콜백 안에서만 유효하다. 드라이버가 콜백을 다시 실행할 수 있으므로 S3 쓰기나 메시지 발행은 밖에 둔다. 쓰기 확인이 `wtimeout`으로 끝나도 쓰기 자체는 이미 반영됐을 수 있다. [가입 트랜잭션](../apps/api/src/services/application/user-registration/user-registration.service.ts) · [연결 옵션](common/src/mongodb/__tests__/connections.spec.ts)

## 인증·메시지·캐시

- **세션 갱신**에서 common은 서명을 검증하고 같은 갱신 토큰을 한 번만 교체한다. 계정 탈퇴·비밀번호 변경 여부는 앱이 `refreshAuthTokens(refreshToken, validateSession)`의 콜백에서 검사한다. 콜백이 예외를 던지면 토큰을 교체하기 전에 오류를 전달한다. [계정 검증 함수](../apps/api/src/services/core/users/internal/user-authentication.service.ts)
- **NATS 구독**은 `await subscribe()`가 끝나면 서버에 등록된 상태이므로 바로 발행할 수 있다. 종료 시에는 실행 중인 핸들러가 끝날 때까지 기다린다. `JetStreamChannel.consume()`로 연 구독은 다음 메시지를 읽지 않아도 `close()`로 닫을 수 있고, 구독이 실패했으면 이때 같은 오류를 던진다. Redis·NATS 연결을 닫다가 실패하면 `AggregateError.errors`에서 원인을 확인할 수 있고 다시 종료하면 실패한 연결만 정리한다. [구독 테스트](common/src/nats/__tests__/nats-pubsub.service.spec.ts) · [연결 종료 테스트](common/src/nats/__tests__/nats.module.spec.ts)
- **분산 락**에서 `withLock`은 키가 이미 잠겼으면 `{ ran: false }`를 반환한다. `withLockBlocking`의 `waitMs`는 락 획득을 기다리는 시간이며 초과하면 503 예외를 던진다. 작업 중에 락이 만료되지 않도록 `ttlMs`를 최대 작업 시간보다 길게 잡는다. [락 경합과 TTL 테스트](common/src/cache/__tests__/cache.service.spec.ts)
- **TTL 0**에서 `set`은 값을 만료 없이 저장하고, `incrementWithExpiry`는 새 카운터 값 1을 반환한 뒤 즉시 만료시킨다. `withLock`은 콜백 실행 전에 예외를 던진다. [메서드별 만료 동작](common/src/cache/__tests__/cache.service.spec.ts)

## JSON과 DTO 복원

`JsonUtil`은 `Temporal.Instant`를 밀리초 세 자리의 UTC 문자열로, `Temporal.PlainDate`를 ISO 달력 날짜로 기록한다. 날짜처럼 보이는 일반 문자열과 구분하려면 DTO 스키마에서 복원할 필드를 지정한다. [날짜와 문자열의 왕복 테스트](common/src/utils/__tests__/json.spec.ts)

```ts
const date = Temporal.PlainDate.from('2023-06-18')
const json = JsonUtil.stringify({ date, title: '2023-06-18' })
const schema = z.object({ date: PlainDateFromInputSchema, title: z.string() })
const output = schema.parse(JSON.parse(json))
expect(output.date.equals(date)).toBe(true)
expect(output.title).toBe('2023-06-18')
```

Restate workflow의 입력과 최종 결과에는 등록된 스키마가 적용된다. 저장된 중간 결과에서 `Temporal` 같은 타입이 필요하면 workflow 작성자가 `ctx.run`의 반환값을 스키마로 복원한다. [workflow 직렬화 테스트](common/src/restate/__tests__/temporal-json.serde.spec.ts)

## 테스트 도구

Nest 서비스는 `createTestContext`, HTTP를 호출하는 테스트는 `createHttpTestContext`로 시작한다. 생성에 성공하면 호출자가 `close()`로 앱을 닫는다. `request.ok({ schema, expected })`는 복원한 DTO를, `request.ok({ expected })`는 원래 JSON을 비교한다. [초기화와 종료](testing/src/__tests__/create-test-context-cleanup.spec.ts) · [HTTP 응답 검증](testing/src/__tests__/http.test-client.spec.ts)

SSE 테스트는 `request.sse(messageHandler, errorHandler, readyHandler)`의 준비 신호를 기다린 뒤 별도 클라이언트로 발행한다. 끝나면 `finally`에서 `request.abort()`로 구독을 닫는다. [구독과 발행 예제](testing/src/__tests__/http.test-client.spec.ts)
