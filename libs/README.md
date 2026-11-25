# libs/ — 공유 패키지

여러 NestJS 프로젝트에서 재사용하는 패키지다. 업무 규칙과 화면·쿠키 처리는 사용하는 앱이 정한다.

## 1. 공통 코드와 테스트 도구의 위치

- `@mannercode/common`은 앱이 운영 중에 호출하는 외부 연동과 유틸리티를 제공한다. [공개 API](common/src/index.ts)
- `@mannercode/testing`은 spec·fixture에서 쓸 Nest 테스트 context와 HTTP 클라이언트를 제공한다. 앱의 개발 의존성에 둔다. [공개 API](testing/src/index.ts)
- Vitest가 라이브러리 빌드와 소스 변환 전에 불러야 하는 준비·정리 함수는 CommonJS로 제공한다. [Vitest 도우미](../tools/vitest-helpers/index.js)

Nest 모듈과 주입된 서비스를 검증할 때는 `createTestContext`, HTTP 요청까지 보낼 때는 `createHttpTestContext`를 쓴다. 생성에 성공하면 호출자가 `close()`로 앱을 닫는다. 초기화 도중 실패하면 테스트 도구가 생성한 앱을 정리하고 원래 오류를 전달한다. [초기화·종료 테스트](testing/src/__tests__/create-test-context-cleanup.spec.ts)

## 2. SDK 연결과 호출은 common에서 구현한다

같은 SDK를 쓰는 앱들도 저장할 데이터와 장애 처리 방식은 다를 수 있다. common은 연결 수명과 SDK 호출을 맡고, 접속 설정·도메인 쿼리·인덱스·이벤트 내용·workflow 단계는 앱이 정한다. 앱에서 NestJS·Zod·RxJS·Express 미들웨어를 직접 쓸 수 있다. 독립 실행 스크립트는 common 빌드 없이 실행하기 위해, 테스트는 상태 확인이나 장애 재현을 위해 SDK를 직접 사용할 수 있다. [API의 SDK import 검사](../oxlint.config.mts)

common을 가져가는 프로젝트는 선언된 peer dependency를 설치한다. 특히 테스트 환경과 앱의 Nest HTTP adapter 버전을 맞춘다. Nest core가 두 번 로드되면 같은 클래스도 DI 토큰이 달라질 수 있다. [패키지 의존성](common/package.json)

### 로그인 세션에서 앱이 판단할 일

공통 인증 서비스는 서명을 확인하고 같은 로그인 세션의 갱신 토큰을 한 번만 교체한다. 비밀번호가 바뀌었거나 계정이 탈퇴했을 때 갱신을 허용할지는 사용자 도메인이 판단한다. 앱이 `refreshAuthTokens`에 검증 함수를 전달하면 서명이 확인된 주체와 클레임을 받고, 검증에 실패하면 토큰 교체 전에 그 오류가 호출자에게 전달된다. [세션 검증·동시 교체 테스트](common/src/auth/__tests__/jwt-auth.service.spec.ts)

저장된 해시가 없는 계정도 비밀번호 비교를 수행하는 이유는 로그인 실패의 응답 시간 차이를 줄이기 위해서다. [비밀번호 검증 테스트](common/src/auth/__tests__/guards.spec.ts) · [Argon2id 설정](common/src/auth/password.ts) · [설정 근거](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)

### 구독·연결·락의 수명

`NatsPubSubService.subscribe()`를 기다리면 같은 subject·queue에 동시에 등록한 호출도 서버에서 구독 처리가 끝난 뒤 발행할 수 있다. 종료 시에는 이미 실행 중인 handler가 끝날 때까지 기다린다. Redis·NATS 연결을 닫다가 실패하면 `AggregateError.errors`에 원인이 남고, 다시 종료하면 실패했던 연결만 정리한다. [구독·재구독·종료 테스트](common/src/nats/__tests__/nats-pubsub.service.spec.ts) · [Redis 연결 정리](common/src/redis/__tests__/redis.module.spec.ts) · [NATS 연결 정리](common/src/nats/__tests__/nats.module.spec.ts)

`withLock`은 키가 이미 잠겨 있으면 `{ ran: false }`를 반환한다. `withLockBlocking`의 `waitMs`는 콜백을 시작할 수 있는 기한이며, 기한이 지나면 503 예외를 던진다. 시작한 작업을 끝까지 단독 실행하려면 락의 `ttlMs`를 작업의 최대 실행 시간보다 길게 잡는다. 캐시·카운터·락에서 0의 의미가 다르므로 호출별 만료 조건은 실행 예제를 참고한다. [락 경합·기한·TTL 테스트](common/src/cache/__tests__/cache.service.spec.ts)

## 3. 저장소 ID와 트랜잭션

Repository의 CRUD 메서드에는 문자열 문서 ID를 넘긴다. 직접 MongoDB 필터를 작성할 때는 `idFilter`·`idsFilter`로 문서 ID를 표시한다. 일반 문자열은 집계 그룹의 `_id`로도 쓸 수 있어 문자열 그대로 유지한다. CRUD 결과의 `id`는 문자열이며 projection에서 `_id`를 제외하면 생략된다. 집계 결과는 필드 이름을 유지하고 ObjectId 값만 문자열로 바꾼다. [조회·projection·집계·인덱스 테스트](common/src/mongodb/__tests__/crud.repository.spec.ts)

같은 트랜잭션에 참여할 Repository들에 콜백의 `TransactionContext`를 전달하고, 한 세션의 DB 작업은 순서대로 실행한다. context는 해당 콜백 실행 동안만 유효하다. 드라이버가 콜백을 재시도할 수 있으므로 S3 쓰기와 메시지 발행처럼 되돌릴 수 없는 작업은 밖에 둔다. 페이지 목록과 개수를 한 시점 기준으로 읽어야 할 때는 snapshot 트랜잭션을 사용한다. [트랜잭션 구현](common/src/mongodb/mongo-transaction.repository.ts) · [페이지 조회 테스트](common/src/mongodb/__tests__/crud.repository.spec.ts)

과반수 복제와 journal 쓰기 확인을 기다리다 `wtimeout` 오류를 받아도 쓰기가 이미 반영됐을 수 있다. 같은 쓰기를 재시도할 때는 이 가능성을 고려한다. [연결 옵션 테스트](common/src/mongodb/__tests__/connections.spec.ts)

## 4. JSON과 DTO 복원

JSON에는 날짜 타입 정보가 없으므로 DTO 스키마에서 날짜 필드를 지정한다. `JsonUtil`은 `Temporal.Instant`를 밀리초 세 자리의 UTC 문자열로, `Temporal.PlainDate`를 같은 날짜의 ISO 달력 문자열로 기록한다. 정밀도를 보존해야 하는 큰 정수는 문자열로 전송한다. [날짜와 일반 문자열의 왕복 예제](common/src/utils/__tests__/json.spec.ts) · [허용하는 날짜 입력](common/src/utils/__tests__/date.schema.spec.ts)

Restate의 `defineWorkflow`는 입력 스키마를, `RestateWorkflowClient`는 최종 결과 스키마를 적용한다. 저장된 step 결과에서 `Temporal` 같은 타입이 필요하면 workflow 작성자가 `await ctx.run(...)`에서 받은 값을 스키마로 복원한다. 진행 중인 작업의 step 순서·이름·저장 형식을 바꿀 때는 이전 기록을 읽을 버전도 계속 제공한다. [직렬화와 workflow 입력 테스트](common/src/restate/__tests__/temporal-json.serde.spec.ts) · [완료 결과 복원 테스트](common/src/restate/__tests__/workflow-client.spec.ts) · [버전별 배포 주소](../README.md#restate-배포-주소)

`HttpTestClient`에 응답 스키마를 주면 `body`에서 변환된 타입을 받는다. `expected`도 스키마가 있으면 변환한 값과, 생략하면 원래 JSON과 비교한다. [HTTP 응답 검증 예제](testing/src/__tests__/http.test-client.spec.ts)

## 5. SSE 이벤트를 받는 테스트 작성

`HttpTestClient.sse`는 응답이 HTTP 200이고 `Content-Type`이 `text/event-stream`이면 준비 콜백을 부른다. 그 신호를 기다린 뒤 이벤트를 발행한다. 먼저 발행하면 구독이 열리기 전에 이벤트가 지나갈 수 있다. 스트림은 `finally`에서 닫는다. [준비 콜백과 정리 예제](testing/src/__tests__/http.test-client.spec.ts)

## 6. 공통 유틸의 입력·반환 규칙

- 파일 시스템을 넘는 이동, 대상 디렉터리 충돌 시 원본 보존, 경로 조회 오류는 [파일 작업 테스트](common/src/utils/__tests__/path.spec.ts)에서 확인한다.
- 복합 단위의 부호·지수 표기와 달력이 다른 날짜의 비교는 [시간 단위](common/src/utils/__tests__/time.spec.ts), [바이트 단위](common/src/utils/__tests__/byte.spec.ts), [Temporal 값 비교](common/src/utils/__tests__/lodash.spec.ts)에 입력·기대값 쌍으로 있다.
- 설정값과 DTO 필드는 [환경 변수 입력](common/src/utils/__tests__/env.spec.ts), [설정 getter의 타입 변환](common/src/config/__tests__/base-config.service.spec.ts), [필드 생략과 null 매핑](common/src/mongodb/__tests__/mongo.util.spec.ts)을 참고한다.

## 7. TypeScript 작성 규칙

객체·유니온은 `type`, 클래스가 구현할 계약이나 선언 병합은 `interface`를 쓴다. 파일 경로 변수는 `Path`, 디렉터리 경로 변수는 `Dir`로 끝낸다.

백엔드의 상대 import는 Node ESM이 빌드 후 읽을 `.js`까지 적고, 디렉터리는 `index.js`를 지정한다. 패키지명과 `#core` 같은 별칭은 그대로 쓴다. 타입 전용 참조는 `import type`으로, Nest가 생성자에서 DI 토큰으로 사용할 클래스는 값으로 가져온다. ESM 패키지에서 CommonJS로 실행할 도구는 `.cjs`를 쓴다. [컴파일 설정](../tsconfig.json) · [생성자 타입 메타데이터 테스트](testing/src/vitest/__tests__/decorator-metadata.spec.ts)
