# libs/ — 공유 패키지

여러 NestJS 프로젝트에서 공유하는 패키지다. 업무 규칙과 화면·쿠키 처리는 앱에 둔다.

## 1. 공통 코드와 테스트 도구의 위치

| 위치                                                                                 | 책임                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `libs/common`                                                                        | 앱이 운영 중 호출하는 외부 연동과 공통 유틸                            |
| `libs/testing`                                                                       | spec·fixture의 HTTP client와 테스트 context. 앱의 개발 의존성으로 사용 |
| [tools/vitest-helpers](../tools/README.md#1-vitest-helpers--테스트-자원-준비와-정리) | 라이브러리 빌드·소스 변환 전에 실행되는 Vitest 준비·정리               |

## 2. SDK 연결과 호출은 common에서 구현한다

common은 API의 MongoDB·Redis·Argon2id·JWT·S3·NATS·JetStream·Restate 호출을 맡는다. 접속 설정과 쿼리·인덱스·이벤트 내용·workflow 단계는 앱에서 제공한다.

앱은 NestJS·Zod·RxJS·Express 타입·HTTP 미들웨어를 직접 사용한다. 독립 실행 스크립트는 common 빌드 없이 실행하기 위해, 테스트는 상태 확인이나 장애 재현을 위해 SDK를 직접 사용할 수 있다.

common의 peer dependency는 사용하는 프로젝트가 설치한다. 루트 테스트 환경과 API의 Nest HTTP adapter 버전을 맞춘다. Nest core가 중복 로드되면 같은 클래스도 DI 토큰이 달라질 수 있다.

### 메시지와 락의 완료 조건

같은 NATS subject·queue에 동시에 구독하면 모든 호출이 서버의 SUB 처리를 기다린다. 등록에 실패하면 모두 오류를 받고 구독은 정리된다. 종료할 때는 새 handler를 막고, 이미 구독을 해제했어도 실행 중인 handler를 기다린다. [구독 테스트](common/src/nats/__tests__/nats-pubsub.service.spec.ts)

캐시 TTL은 정수 밀리초다. `set`의 0은 영구 저장이고, 락 TTL은 양수여야 한다. `incrementWithExpiry`는 카운터가 1이 될 때만 만료 시각을 설정한다. 이때 TTL이 0 이하이면 즉시 만료된다.

`withLock`은 Redis 키 하나로 락을 잡고, 이미 사용 중이면 작업을 건너뛴다. `withLockBlocking`은 락을 기다리되 `waitMs` 안에서만 콜백을 시작한다. 기한을 넘기면 늦게 얻은 락도 해제하고 503을 던진다. `waitMs`가 0이면 획득을 시도하지 않는다. [락·만료 테스트](common/src/cache/__tests__/cache.service.spec.ts)

## 3. 저장소 ID와 트랜잭션

DTO와 Repository의 ID는 문자열이다. 조회 조건 중 `idFilter`·`idsFilter`로 만든 ID만 BSON ObjectId로 변환한다. 일반 `_id` 문자열은 집계 그룹 키로 쓸 수 있다. ObjectId 문자열의 대소문자는 구분하지 않는다.

생성·조회·갱신 결과는 `_id`를 문자열 `id`로 반환한다. projection에서 제외한 ID는 생략한다. 집계 결과는 `_id`라는 이름을 유지하고 ObjectId 값만 문자열로 바꾼다. 같은 컬렉션의 저장소도 인덱스를 각자 적용하며 충돌하면 초기화가 실패한다. [Repository 사용 예제](common/src/mongodb/__tests__/crud.repository.spec.ts)

앱은 함께 처리할 작업·snapshot·시간 제한을 정하고 `TransactionContext`를 전달한다. 세션과 드라이버 옵션은 common이 관리한다. 같은 세션에서는 DB 작업을 순서대로 실행한다.

과반수 복제와 journal 쓰기를 기한 내 확인하지 못하면 오류를 전달한다. `wtimeout`은 이미 반영된 쓰기를 취소하지 않는다. 페이지의 목록과 개수에는 같은 트랜잭션에서 쓴 값이 함께 반영된다. 트랜잭션 밖에서는 둘을 병렬 조회하므로 결과 시점이 다를 수 있다.

## 4. JSON과 DTO 복원

JSON에서 복원할 타입은 DTO 스키마에 명시한다. 큰 정수의 정밀도를 보존하려면 JSON 문자열로 전달한다.

JsonUtil·HTTP 응답·Restate는 `Temporal.Instant`를 밀리초 3자리의 UTC 문자열로, `Temporal.PlainDate`를 ISO 날짜 문자열로 직렬화한다. PlainDate 객체는 같은 날짜의 ISO 달력으로 정규화한다. 문자열은 달력 주석 없는 ISO 날짜만 받는다. [JSON 직렬화](common/src/utils/__tests__/json.spec.ts) · [날짜 입력](common/src/utils/__tests__/date.schema.spec.ts)

Restate는 workflow 입력·step DTO·최종 결과를 각각의 스키마로 복원한다. 진행 중인 작업의 step 이름·순서·저장 형식을 바꿀 때는 새 버전을 별도 주소로 등록한다. [Workflow 버전 등록](../infra/README.md#4-restate에-workflow-실행-주소-등록)

`HttpTestClient`에 `schema`를 주면 응답을 검증·변환하고 `body`에 그 타입을 적용한다. `expected`는 스키마가 있으면 변환한 응답과, 없으면 원래 JSON과 비교한다. [사용자 API 테스트](../apps/api/src/__tests__/core/users.spec.ts)

## 5. SSE 이벤트를 받는 테스트 작성

`HttpTestClient.sse`의 세 번째 인자인 준비 완료 콜백이 호출되면 이벤트를 발생시킬 요청을 보낸다. 스트림은 `finally`에서 닫는다. [수신 예제와 오류 처리](testing/src/__tests__/http.test-client.spec.ts)

## 6. 공통 유틸의 입력·반환 규칙

- `isEqual`은 중첩된 Temporal 값의 타입·달력·참조 날짜까지 비교한다. [비교 예제](common/src/utils/__tests__/lodash.spec.ts)
- 시간·바이트 단위는 소수와 지수 표기를 지원한다. 여러 단위의 음수는 `-1h-30m`, `-1KB -0.5B`처럼 항목마다 부호를 붙인다. [시간](common/src/utils/__tests__/time.spec.ts) · [바이트](common/src/utils/__tests__/byte.spec.ts)
- `Env`는 대소문자 구분 없이 `true`·`false`만 불리언으로 받는다. 숫자 필드에서 공백 문자열·`NaN`·`Infinity`는 오류다. `BaseConfigService`는 getter 타입에 맞는 값만 변환한다. [환경 변수](common/src/utils/__tests__/env.spec.ts) · [설정 getter](common/src/config/__tests__/base-config.service.spec.ts)
- `assignIfDefined`는 `undefined`만 건너뛴다. `null`은 복사하거나 변환 함수에 전달한다. [필드 매핑](common/src/utils/mapping.ts)
- `PasswordHasher`는 저장된 해시가 없어도 비교 연산을 수행한 뒤 false를 반환한다. [Argon2id 설정](common/src/auth/password.ts) · [설정 근거](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)

## 7. TypeScript 작성 규칙

객체·유니온은 `type`, 클래스가 구현할 계약이나 선언 병합은 `interface`를 쓴다. 파일 경로 변수는 `Path`, 디렉터리 경로 변수는 `Dir`로 끝낸다.

백엔드는 Node ESM·TypeScript NodeNext를 사용한다. 상대 import에는 빌드 결과의 `.js`를 붙이고 디렉터리는 `index.js`까지 적는다. 패키지명과 `#core` 같은 별칭은 그대로 쓴다. 타입 전용 참조에는 `import type`을 사용한다. ESM 패키지의 CommonJS 도구에는 `.cjs`를 쓴다.
