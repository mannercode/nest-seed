# libs/ — 공유 패키지

다른 NestJS 프로젝트에도 가져갈 수 있는 실행 코드와 테스트 도구를 둔다. 영화·상영·구매 같은 업무 규칙은 앱이 소유한다. 사용법은 공개 심볼의 타입과 JSDoc이, 도구 선택의 이유는 [설계 결정](reference/decisions.md)이 설명한다.

## 1. 코드가 실행되는 곳으로 나눈다

| 위치                   | 책임                                                   |
| ---------------------- | ------------------------------------------------------ |
| `libs/common`          | 앱이 운영 중 호출하는 외부 연동과 공통 유틸            |
| `libs/testing`         | spec과 fixture가 import하는 HTTP client·테스트 context |
| `tools/vitest-helpers` | 소스 변환 전에 실행되는 Vitest 준비·정리               |

앱은 `testing`을 dev dependency로만 사용한다. Vitest 부팅 도구를 라이브러리 빌드에 의존시키면 테스트 준비를 위해 먼저 테스트 환경이 필요해지므로 [tools](tools.md)에 별도로 둔다.

## 2. common은 연동 구현을 소유한다

`apps/api/src`는 MongoDB 연결·드라이버 실행, Redis 명령, bcrypt·JWT, S3, NATS·JetStream, Restate 서버·클라이언트를 common을 통해 사용한다. 앱은 collection별 조건과 인덱스, 이벤트 내용, workflow의 업무 단계와 정책을 정의한다. 설정값은 앱이 주입하며 common이 특정 앱의 env 파일을 찾아 읽지 않는다.

이 경계는 SDK 실행과 연결 수명의 소유권을 정한다. MongoDB 쿼리를 SQL에서도 실행할 수 있게 하거나 NestJS 전체를 교체 가능하게 만드는 추상화는 아니다.

API는 요청이 몰릴 때 MongoDB 연결 생성까지 경쟁하지 않도록 최소 연결을 유지한다. 짧게 쓰는 테스트 연결에는 이 예비 연결을 요구하지 않는다.

- NestJS·Zod·RxJS와 Express 타입·HTTP 미들웨어처럼 앱 작성에 사용하는 API는 직접 사용한다.
- `apps/api/scripts`의 독립 실행 스크립트는 SDK를 직접 사용하며 common 빌드에 의존하지 않는다.
- 테스트는 외부 상태 관찰과 장애 주입을 위해 SDK에 직접 접근할 수 있다.
- console·user-app의 쿠키·인증 프록시·화면 코드는 각 앱이 소유한다. 데모 두 곳의 코드가 비슷해도 common으로 옮기지 않는다.

common의 peer dependency는 소비자가 설치해야 할 런타임 계약이다. API의 package.json에 MongoDB·Redis SDK가 있다고 앱 소스가 직접 사용한다는 뜻은 아니다. 의존성 설치와 소스의 호출 경계를 구분한다.

테스트 context를 만드는 루트도 API와 같은 Nest HTTP adapter 버전을 설치한다. 다른 peer 조합으로 Nest core가 중복 로드되면 `Reflector` 같은 클래스 주입 토큰이 일치하지 않는다.

NATS의 같은 subject·queue에 동시에 등록한 구독자도 동일한 SUB 처리 확인을 기다린 뒤 반환한다. 준비 실패는 모든 대기자에게 전달하고 해당 구독을 정리한다. 이 확인은 메시지의 영속 저장이나 소비자 처리 완료를 뜻하지 않는다.

`generateUuid` 같은 유틸은 기억하기 쉬운 기능 이름과 일관된 사용법을 제공한다. Node.js 기본 함수도 이 목적이면 감쌀 수 있고 기존 래퍼는 유지한다. Node API 전체를 복제하거나 런타임 교체에 대비한 계층은 만들지 않는다.

## 3. 저장소 ID와 트랜잭션

앱의 DTO와 Repository는 ID를 문자열로 주고받는다. DB 문서 ID 조건은 Repository가 helper로 명시한다.

```ts
{ ...this.idFilter(id), __v: version }
{ $or: [this.idsFilter(ids), { title }] }
```

common은 이 조건을 BSON ObjectId로 만들지만, 모든 `_id` 문자열을 순회하며 추측하지 않는다. 집계의 문자열 그룹 키는 `{ _id: 'group-name' }` 그대로 사용할 수 있다.

생성·조회·갱신 결과의 문서 `_id`는 문자열 `id`로 반환한다. ID를 제외한 projection에는 `id`를 추가하지 않는다. 집계 결과의 `_id`는 그룹 필드명이므로 이름을 유지하고 ObjectId 값만 문자열로 바꾼다. `newDocument`는 문자열 ID를 만들며 실제 저장 경계에서 BSON으로 바꾼다. `toDomainDocument`는 이미 ID와 시간 값이 변환된 문서를 받는다.

트랜잭션은 DB 타입이 없는 `TransactionContext`로 전달하고 MongoDB 세션·드라이버 옵션은 common이 관리한다. 업무 단위와 필요한 snapshot·시간 제한의 선택은 앱에 남는다. Temporal 값의 BSON 변환은 문자열 추측 없이 실제 타입을 기준으로 수행한다.

같은 트랜잭션 세션에서는 MongoDB 작업을 병렬 실행하지 않는다. 페이지 조회의 목록과 개수도 순서대로 읽어 같은 미커밋 변경을 관찰한다. 트랜잭션이 없는 페이지 조회는 병렬 실행하며 목록·개수의 단일 snapshot을 보장하지 않는다.

## 4. JSON과 DTO 복원

일반 JSON 파싱은 `JSON.parse`로 한다. 날짜처럼 보이는 문자열이나 큰 숫자의 타입을 자동 추측하지 않는다. 날짜·시점으로 복원할 필드는 DTO 스키마에 명시한다. 정밀도 보존이 필요한 큰 정수는 JSON 문자열 계약으로 다룬다.

`JsonUtil.stringify`와 HTTP 응답은 Instant를 UTC 밀리초 3자리, PlainDate를 날짜 문자열로 내보낸다. Restate도 같은 JSON 형식을 저장하며 workflow 입력·step의 DTO 결과·최종 결과는 각 스키마로 복원한다. 재실행 때 journal 값을 읽으므로 step 이름·순서·저장 형식 변경은 복구 중인 데이터와 함께 검토해야 한다.

테스트 응답도 같은 DTO 스키마를 사용한다.

```ts
const { body } = await fix.httpClient
    .post('/purchases')
    .headers(headers)
    .body(createDto)
    .created({ schema: PurchaseRecordSchema })
```

`body`는 스키마 출력 타입으로 추론되고 변환 실패는 테스트 실패다. `{ schema, expected }`는 변환 결과까지 비교한다. `{ expected }`는 JSON 응답을 변환 없이 비교한다. 제네릭 타입 인자만으로 런타임 변환이 일어나지는 않는다.

## 5. 테스트의 SSE 수신

SSE로 요청 결과를 검증할 때는 `HttpTestClient.sse`의 세 번째 콜백으로 응답 스트림의 수신 준비를 확인한 뒤 요청한다. 첫 이벤트가 올 때까지 기다리면 요청과 구독이 서로 기다릴 수 있다. 완료·실패 여부와 관계없이 테스트가 연 스트림은 `finally`에서 닫는다.

## 6. 공통 유틸의 값 계약

- `isEqual`은 Node의 엄격한 비교에 더해 열거 가능한 속성·배열·Map·Set 안의 Temporal 값도 비교한다. 순환 구조, Temporal 타입과 달력·참조 날짜를 보존하며 문자열 날짜와 같은 값으로 취급하지 않는다.
- `TimeUtil`은 각 시간 항목의 부호를 합산한다. 음수 복합 시간도 `-1h-30m`처럼 표시해 밀리초로 다시 읽으면 원래 값이 된다.
- `Env`의 불리언은 대소문자와 관계없이 `true`·`false`만 받는다. 숫자의 공백 입력과 비유한 값도 설정 오류로 거절한다.
- `countBy`는 `constructor`·`__proto__` 같은 문자열도 독립적인 키로 집계한다.
- `PasswordHasher.verify`는 저장된 해시가 없으면 항상 false다. 기존 dummy 비교는 실패 응답 시간 차이를 줄이기 위한 작업이며 인증 성공을 만들지 않는다.
