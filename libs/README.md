# libs/ — 공유 패키지

다른 NestJS 프로젝트에서도 사용하는 공통 코드와 테스트 도구다. 업무 규칙과 화면·쿠키 처리는 앱에 둔다. 시드의 사용처 수가 아니라 [재사용 라이브러리의 공개 계약](../AGENTS.md#영역별-판단-기준)을 기준으로 변경한다.

## 1. 공통 코드와 테스트 도구의 위치

| 위치                                                                                 | 책임                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `libs/common`                                                                        | 앱이 운영 중 호출하는 외부 연동과 공통 유틸                            |
| `libs/testing`                                                                       | spec·fixture의 HTTP client와 테스트 context. 앱의 개발 의존성으로 사용 |
| [tools/vitest-helpers](../tools/README.md#1-vitest-helpers--테스트-자원-준비와-정리) | 라이브러리 빌드·소스 변환 전에 실행되는 Vitest 준비·정리               |

## 2. SDK 연결과 호출은 common에서 구현한다

`apps/api/src`의 MongoDB·Redis·Argon2id·JWT·S3·NATS·JetStream·Restate 연결과 호출은 common이 맡는다. 앱은 쿼리·인덱스·이벤트 내용·workflow 단계와 설정값을 제공한다. common이 앱의 env 파일을 읽지는 않는다. 이 구분은 기술 교체를 자동화하지 않으며 앱의 MongoDB 쿼리와 NestJS 의존성은 남는다.

NestJS·Zod·RxJS·Express 타입·HTTP 미들웨어는 앱에서 직접 사용한다. 독립 실행 스크립트는 common 빌드 없이 실행하도록 SDK를 직접 사용할 수 있고, 테스트도 상태 관찰·장애 주입을 위해 SDK에 접근할 수 있다. web의 BFF·화면은 common으로 옮기지 않는다.

common의 peer dependency는 소비 프로젝트가 설치한다. 테스트 context를 만드는 루트도 API와 같은 Nest HTTP adapter 버전을 사용한다. 중복 로드된 Nest core는 `Reflector` 같은 클래스의 주입 토큰을 다르게 만들 수 있다. API의 MongoDB 연결은 요청마다 연결을 준비하는 비용을 줄이기 위해 예비 연결을 유지하며 짧게 쓰는 테스트에는 이를 요구하지 않는다.

### 메시지와 락의 완료 조건

[NATS 구독](common/src/nats/nats-pubsub.service.ts)은 같은 subject·queue의 동시 등록 모두 서버의 SUB 처리를 기다린다. 실패하면 모두에게 오류를 전달하고 구독을 정리한다. 등록 완료는 메시지 저장·소비 완료를 뜻하지 않는다. 종료 훅은 새 handler를 막고, 마지막 구독을 이미 해제했어도 진행 중인 handler가 끝날 때까지 기다린다.

[CacheService](common/src/cache/cache.service.ts)의 TTL은 정수 밀리초다. 잘못된 값은 Redis 쓰기 전에 거절한다. `set`의 0은 영구 저장, `incrementWithExpiry`의 0·음수는 즉시 만료이며 `withLock`은 양수만 허용한다.

`withLock`은 중복 작업을 건너뛰고 `withLockBlocking`은 락을 기다린다. 후자는 `waitMs` 안에서만 콜백을 시작하며 기한이 지나면 늦게 얻은 락도 해제하고 503을 던진다. 0이면 획득을 시도하지 않으며 이미 시작한 콜백의 시간은 제한하지 않는다. 현재 Redis Cluster의 단일 키 락은 독립 master 여러 개를 전제로 하는 Redlock과 같은 보장이 아니다.

## 3. 저장소 ID와 트랜잭션

DTO·Repository의 ID는 문자열이다. [idFilter·idsFilter](common/src/mongodb/crud.repository.ts)로 만든 조건만 BSON ObjectId로 변환한다. 일반 `_id` 문자열을 자동 변환하지 않으므로 집계 그룹 키로 사용할 수 있다. ObjectId 문자열의 대소문자는 구분하지 않는다. 같은 collection을 사용하는 저장소도 각자 인덱스를 적용하며 충돌은 초기화 오류다.

생성·조회·갱신 결과는 `_id`를 문자열 `id`로 반환하며 projection으로 제외하면 반환하지 않는다. 집계는 `_id` 필드명을 유지하고 ObjectId 값만 문자열로 바꾼다. `newDocument`는 문자열 ID를 만들고 저장 시 BSON으로 변환한다. `toDomainDocument`는 ID·시간 변환이 끝난 문서를 받는다.

앱은 DB 타입이 없는 `TransactionContext`를 전달하고 common이 세션·드라이버 옵션을 관리한다. 묶을 작업·snapshot·시간 제한은 앱이 결정한다. Temporal 값은 실제 타입으로 BSON 변환하며 문자열 모양으로 추측하지 않는다.

과반수 복제와 journal 쓰기는 기한 내에서 확인한다. `wtimeout`이 이미 반영한 쓰기를 취소하지는 않으므로 시간 초과를 성공이나 rollback으로 간주하지 않고 오류를 전달한다. 같은 세션의 DB 작업은 순서대로 실행한다. 페이지의 목록·개수도 미커밋 변경을 함께 읽지만, transaction 밖에서는 병렬 조회하므로 같은 시점의 결과라는 보장이 없다.

## 4. JSON과 DTO 복원

JSON은 `JSON.parse`로 읽고 DTO 스키마에 복원할 타입을 명시한다. 타입 인자·문자열 모양·숫자 크기로 런타임 변환을 추측하지 않는다. 큰 정수의 정밀도를 보존하려면 JSON 문자열로 전달한다.

[JsonUtil](common/src/utils/json.ts)·HTTP 응답·Restate는 Instant를 밀리초 3자리의 UTC 문자열로, PlainDate를 날짜 문자열로 저장한다. PlainDate 객체는 입력·저장·직렬화·UTC 날짜 계산에서 같은 날짜의 ISO 달력으로 정규화하며 달력 식별자를 보존하지 않는다. 문자열은 달력 주석 없는 ISO 날짜만 받는다.

Restate의 workflow 입력·step DTO·최종 결과는 각각의 스키마로 복원한다. step 이름·순서·저장 형식 변경은 [진행 중인 작업의 배포 조건](../apps/README.md#진행-중인-작업을-보존하는-배포)을 따른다.

[HttpTestClient](testing/src/http.test-client.ts)의 `schema`는 응답 검증·변환과 `body` 타입을 결정하며 실패하면 테스트도 실패한다. `{ schema, expected }`는 변환한 응답을, `{ expected }`는 원래 JSON을 비교한다. 사용 예시는 [사용자 API 테스트](../apps/api/src/__tests__/core/users.spec.ts)에 있다.

## 5. SSE 이벤트를 받는 테스트 작성

`HttpTestClient.sse`의 세 번째 인자인 준비 완료 콜백 뒤에 이벤트를 발생시킬 요청을 보낸다. 첫 이벤트를 기다리면 요청과 이벤트가 서로 기다릴 수 있다. 스트림은 성공·실패와 관계없이 `finally`에서 닫는다.

TCP 청크가 나뉘어도 UTF-8 문자를 보존하고 여러 `data` 줄은 개행으로 연결한다. 빈 `data`도 전달하며 HTTP 오류 본문은 오류 콜백으로 보낸다. 상세 수신 조건은 [client 테스트](testing/src/__tests__/http.test-client.spec.ts)에 있다.

## 6. 공통 유틸의 입력·반환 규칙

유틸은 사용처 수뿐 아니라 공개 계약과 기능을 찾기 쉬운 이름을 기준으로 유지한다. `generateUuid` 같은 기존 래퍼는 유지하되 Node API 전체를 감싸지는 않는다.

- [isEqual](common/src/utils/lodash.ts)은 동일 객체면 getter 없이 true를 반환한다. 다른 값은 Node의 엄격한 비교에 열거 가능한 속성·배열·Map·Set의 Temporal 비교를 더한다. 순환 구조를 처리하며 Temporal 타입·달력·참조 날짜를 구분한다. 날짜 문자열과 Temporal 값은 다르다.
- [TimeUtil](common/src/utils/time.ts)·[ByteUtil](common/src/utils/byte.ts)은 소수 부분을 보존하며 지수 표기 문자열도 수치로 복원한다. 여러 단위의 음수는 `-1h-30m`, `-1KB -0.5B`처럼 항목마다 부호를 붙인다.
- [Env](common/src/utils/env.ts)의 불리언은 대소문자 무관한 true·false만 받는다. 숫자는 공백만 있는 문자열·NaN·Infinity를 거절한다. [BaseConfigService](common/src/config/base-config.service.ts)도 문자열 getter는 문자열만, 숫자·불리언 getter는 해당 타입 또는 유효한 문자열만 받는다. null·배열·객체를 강제 변환하지 않는다.
- `countBy`·`pick`·`pickBy`는 `constructor`·`__proto__`를 데이터 키로 보존한다. `assignIfDefined`는 undefined만 건너뛰며 null은 복사하거나 transform에 전달한다.
- [Require.equals](common/src/utils/validator.ts)는 불일치한 두 값을 예외 메시지에 담는다. BigInt·순환 객체도 메시지 직렬화 오류로 실패하지 않는다.
- [PasswordHasher](common/src/auth/password.ts)는 [OWASP 구성](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)에 따라 Argon2id 메모리 19 MiB·반복 2회·병렬도 1을 사용한다. 저장된 해시가 없어도 비교 연산을 수행하고 false를 반환한다.

## 7. TypeScript 작성 규칙

객체·유니온은 `type`, 클래스가 구현할 계약이나 선언 병합은 `interface`를 쓴다. 경로 변수는 파일이면 `Path`, 디렉터리면 `Dir`로 끝내 호출자가 파일명을 붙여야 하는지 구분한다.

백엔드는 Node ESM·TypeScript NodeNext를 사용한다. 상대 import에는 빌드 결과의 `.js`를, 디렉터리는 `index.js`를 명시한다. 패키지명·`#core` 같은 별칭에는 확장자를 붙이지 않고 타입 전용 참조는 `import type`을 쓴다. ESM 패키지의 CommonJS 도구는 `.cjs`, ESM 명시는 `.mjs`를 사용한다. CommonJS 패키지의 `.js`는 CommonJS다.

테스트 작성은 [공통 규칙](../tests/README.md#테스트는-한-행동의-결과를-검증한다)을 따른다.
