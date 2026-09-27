# libs/ — 공유 패키지

다른 NestJS 프로젝트에서도 사용할 공통 코드와 테스트 도구를 둔다. 영화·상영·구매 같은 업무 규칙은 앱에 구현한다. 개별 API의 사용법은 타입과 JSDoc에서 확인한다.

이 폴더에는 [재사용 라이브러리 변경·검토 기준](../AGENTS.md#영역별-판단-기준)을 적용한다. 현재 시드의 사용처에 한정하지 않고 여러 프로젝트가 의존하는 라이브러리의 공개 계약을 기준으로 판단한다.

## 1. 공통 코드와 테스트 도구의 위치

| 위치                   | 책임                                                   |
| ---------------------- | ------------------------------------------------------ |
| `libs/common`          | 앱이 운영 중 호출하는 외부 연동과 공통 유틸            |
| `libs/testing`         | spec과 fixture가 import하는 HTTP client·테스트 context |
| `tools/vitest-helpers` | 소스 변환 전에 실행되는 Vitest 준비·정리               |

앱은 `testing`을 개발 의존성으로만 설치한다. Vitest 준비·정리 도구는 라이브러리를 빌드하기 전에도 실행할 수 있도록 [tools](../tools/README.md)에 둔다.

## 2. SDK 연결과 호출은 common에서 구현한다

`apps/api/src`는 MongoDB 연결·드라이버 실행, Redis 명령, bcrypt·JWT, S3, NATS·JetStream, Restate 서버·클라이언트를 common을 통해 사용한다. 앱은 컬렉션별 조회 조건과 인덱스, 이벤트 내용, workflow의 업무 단계와 정책을 정의한다. 설정값은 앱이 주입하며 common이 특정 앱의 env 파일을 찾아 읽지 않는다.

common은 SDK 호출과 연결의 생성·종료를 담당한다. SDK 호출을 모아 두어도 앱의 MongoDB 쿼리와 NestJS 의존성은 남으므로, 다른 기술로 교체하려면 앱 코드도 수정해야 한다.

API는 요청이 몰릴 때마다 새 연결을 만드는 비용을 줄이도록 MongoDB 연결을 일정 수 이상 유지한다. 짧게 쓰는 테스트 연결에는 이 예비 연결을 요구하지 않는다.

- NestJS·Zod·RxJS와 Express 타입·HTTP 미들웨어처럼 앱 작성에 사용하는 API는 직접 사용한다.
- `apps/api/scripts`의 독립 실행 스크립트는 SDK를 직접 사용하며 common 빌드에 의존하지 않는다.
- 테스트는 외부 상태 관찰과 장애 주입을 위해 SDK에 직접 접근할 수 있다.
- console·user-app의 쿠키·인증 프록시·화면 코드는 각 앱에 둔다. 데모 두 곳의 코드가 비슷해도 common으로 옮기지 않는다.

common의 peer dependency는 common을 사용하는 프로젝트가 설치해야 한다. API가 MongoDB·Redis SDK를 설치하더라도 앱 소스에서는 위의 호출 경계를 따른다.

테스트 context를 만드는 루트 패키지도 API와 같은 Nest HTTP adapter 버전을 설치한다. 의존성 조합이 달라 Nest core가 중복 로드되면 `Reflector` 같은 클래스의 주입 토큰이 일치하지 않는다.

같은 subject·queue의 NATS 구독을 동시에 요청하면, 모든 요청이 NATS 서버의 구독 등록(SUB) 처리를 기다린다. 등록에 실패하면 모든 요청에 오류를 전달하고 해당 구독을 정리한다. 구독 등록이 끝났다는 확인은 메시지의 영속 저장이나 소비자의 처리 완료를 뜻하지 않는다.

NATS 종료 훅은 새 handler의 실행을 막고 이미 실행 중인 handler가 끝날 때까지 기다린다. 마지막 구독을 먼저 해제했어도 진행 중인 소비 작업이 끝나야 종료한다.

`CacheService`의 TTL은 정수 밀리초로 지정한다. 유효하지 않은 TTL은 Redis에 쓰기 전에 거절하므로, 만료 시간 설정에 실패하고 카운터만 증가하는 일은 없다. `set`에서 TTL 0은 영구 저장을 뜻하고, `withLock`의 TTL은 양수만 허용한다. `incrementWithExpiry`의 TTL이 0이나 음수이면 카운터를 즉시 만료시킨다.

분산 락은 중복 작업 비용을 줄이는 데 사용한다. 만료된 업로드를 정리할 때는 `withLock`으로 다른 복제본이 작업 중인지 확인하고, 그렇다면 건너뛴다. 락을 기다려야 하는 호출자를 위해 `withLockBlocking`도 제공한다.

`withLockBlocking`은 `waitMs` 안에서만 콜백을 시작한다. 기한이 지나면 늦게 획득한 락도 해제하고 503 예외를 던지며, `waitMs`가 0이면 획득을 시도하지 않는다. 기한 전에 시작한 콜백의 실행 시간은 제한하지 않는다.

Redlock은 독립된 Redis master 여러 개를 전제로 하므로 현재 Redis Cluster의 단일 키 락과 구성이 다르다. 두 방식이 같은 보장을 제공하는 것으로 보지 않는다.

## 3. 저장소 ID와 트랜잭션

앱의 DTO와 Repository는 ID를 문자열로 주고받는다. Repository는 DB 문서의 ID 조건을 다음 helper로 만든다.

```ts
{ ...this.idFilter(id), __v: version }
{ $or: [this.idsFilter(ids), { title }] }
```

common은 이 helper가 받은 ID를 BSON ObjectId로 변환한다. 다른 `_id` 문자열은 자동으로 변환하지 않으므로 집계의 문자열 그룹 키를 `{ _id: 'group-name' }` 그대로 사용할 수 있다.

ObjectId 문자열은 대소문자 구분 없이 같은 ID로 취급한다. 같은 컬렉션을 사용하는 저장소도 각자의 인덱스 선언을 적용하며 충돌은 초기화 오류로 전달한다.

생성·조회·갱신 결과에서는 문서의 `_id`를 문자열 `id`로 반환한다. projection으로 ID를 제외하면 `id`도 반환하지 않는다. 집계 결과의 `_id`는 필드명을 유지하고 ObjectId 값만 문자열로 바꾼다. `newDocument`는 문자열 ID를 만들고 common이 저장할 때 BSON으로 변환한다. `toDomainDocument`는 ID와 시간 값이 이미 변환된 문서를 받는다.

앱은 DB 타입이 없는 `TransactionContext`로 트랜잭션을 전달하고 common이 MongoDB 세션·드라이버 옵션을 관리한다. 어떤 작업을 트랜잭션으로 묶을지, snapshot과 시간 제한이 필요한지는 앱에서 결정한다. Temporal 값은 실제 타입을 기준으로 BSON으로 변환하며 문자열 모양으로 추측하지 않는다.

과반수 복제와 저널 쓰기를 확인할 때는 일시적인 복제·디스크 지연을 기다리되 기한을 둔다. `wtimeout`은 이미 반영된 쓰기를 취소하지 않으므로, 기한을 넘기면 성공이나 rollback으로 추측하지 않고 오류를 전달한다.

같은 트랜잭션 세션에서는 MongoDB 작업을 순서대로 실행한다. 페이지 조회의 목록과 개수도 같은 세션에서 순서대로 읽으므로 아직 커밋하지 않은 변경이 양쪽에 반영된다. 트랜잭션이 없으면 목록과 개수를 병렬로 조회하며 두 결과가 같은 시점의 데이터라는 보장은 없다.

## 4. JSON과 DTO 복원

JSON은 `JSON.parse`로 읽고 날짜·시점으로 복원할 필드를 DTO 스키마에 명시한다. 문자열 모양이나 숫자 크기로 타입을 추측하지 않는다. 정밀도를 보존해야 하는 큰 정수는 JSON 문자열로 주고받는다.

`JsonUtil.stringify`와 HTTP 응답은 Instant를 밀리초가 3자리인 UTC 문자열로, PlainDate를 날짜 문자열로 내보낸다. Restate도 같은 JSON 형식으로 저장하고 workflow 입력과 step의 DTO 결과, 최종 결과를 각 스키마로 복원한다. step 이름·순서·저장 형식을 바꿀 때는 [기존 journal과의 배포 호환 조건](../apps/README.md#진행-중인-작업을-보존하는-배포)을 따른다.

PlainDate 객체는 입력·저장·직렬화·UTC 날짜 계산에서 같은 날짜의 ISO 달력으로 정규화한다. 달력 식별자는 보존하지 않는다. 문자열 입력은 달력 주석 없는 ISO 날짜만 받는다.

테스트 응답도 같은 DTO 스키마를 사용한다.

```ts
const { body } = await fix.httpClient
    .post('/purchases')
    .headers(headers)
    .body(createDto)
    .created({ schema: PurchaseRecordSchema })
```

`schema`는 응답을 검사·변환하고 `body`의 타입도 결정한다. 검사나 변환에 실패하면 테스트가 실패한다. `{ schema, expected }`는 변환한 응답을 예상값과 비교하고, `{ expected }`는 JSON 응답을 변환 없이 비교한다. 제네릭 타입 인자만으로 런타임 변환이 일어나지는 않는다.

## 5. SSE 이벤트를 받는 테스트 작성

SSE로 요청 결과를 검증할 때는 `HttpTestClient.sse`의 세 번째 인자인 준비 완료 콜백이 호출된 뒤, 이벤트를 발생시킬 요청을 보낸다. 첫 이벤트를 받은 뒤 요청하려 하면, 요청이 와야 이벤트를 보내는 서버와 서로 기다리게 된다. 완료·실패 여부와 관계없이 테스트가 연 스트림은 `finally`에서 닫는다.

SSE 수신은 TCP 청크 경계와 관계없이 한글 같은 UTF-8 문자를 보존한다.

같은 SSE 이벤트의 여러 data 줄은 개행으로 연결하고 빈 data도 콜백에 전달한다. HTTP 오류 본문은 오류 콜백으로 전달한다.

## 6. 공통 유틸의 입력·반환 규칙

기존 유틸을 유지할지는 사용처 개수만이 아니라, 제공하는 계약과 기능을 쉽게 찾을 수 있는 이름의 가치로 판단한다. `generateUuid`는 UUID를 만들 때 어떤 Node API를 써야 하는지 매번 찾지 않고, 기능 이름으로 기억하고 호출할 수 있게 한 공통 유틸이다. 같은 목적에 맞는 기존 래퍼는 유지하지만 Node 기본 API 전부를 감싸지는 않는다.

- `isEqual`의 두 인자가 같은 객체를 가리키면 getter를 실행하지 않고 true를 반환한다. 서로 다른 값에는 Node의 엄격한 비교를 적용하고, 열거 가능한 속성·배열·Map·Set에 담긴 Temporal 값도 비교한다. 순환 구조를 처리하며 Temporal의 타입·달력·참조 날짜를 구분한다. 날짜 문자열과 Temporal 값은 같다고 보지 않는다.
- `TimeUtil`과 `ByteUtil`은 단위를 변환할 때 소수 부분을 보존한다. 지수 표기를 포함한 출력 문자열도 다시 수치로 변환할 수 있다. 음수를 여러 단위로 표시할 때는 `-1h-30m`, `-1KB -0.5B`처럼 각 항목에 부호를 붙인다.
- `Env`의 불리언 입력은 대소문자와 관계없이 `true`·`false`만 받는다. 숫자 입력이 공백뿐이거나 NaN·Infinity처럼 유한한 수가 아니면 설정 오류로 거절한다.
- `BaseConfigService`는 env 문자열뿐 아니라 설정 객체의 값도 검사한다. 문자열 getter는 문자열만 받는다. 숫자·불리언 getter는 해당 타입의 값과 유효한 문자열만 받으며 null·배열·객체를 강제 변환하지 않는다.
- `countBy`·`pick`·`pickBy`는 `constructor`·`__proto__` 같은 문자열도 데이터 키로 보존한다.
- `assignIfDefined`는 undefined만 건너뛰고 null은 복사하거나 transform에 전달한다.
- `Require.equals`는 값이 다르면 두 값을 진단 메시지에 담아 불변식 예외를 던진다. BigInt나 순환 객체를 비교해도 메시지를 만드는 과정에서 직렬화 오류가 발생하지 않는다.
- `PasswordHasher.verify`는 저장된 해시가 없으면 항상 false를 반환한다.

## 7. TypeScript 작성 규칙

API와 공유 패키지는 다음 표기를 함께 사용한다. 객체·유니온은 기본적으로 `type`으로 선언한다. 클래스가 구현할 계약을 선언하거나 선언 병합이 필요하면 `interface`를 쓴다.

경로 변수는 파일을 가리키면 `Path`, 디렉터리를 가리키면 `Dir`로 끝낸다. 호출자가 경로에 파일명을 더 붙여야 하는지 알 수 있게 한다.

백엔드는 Node의 ESM과 TypeScript의 NodeNext 설정을 사용한다. 상대 import의 `.js`는 빌드 후 Node가 읽을 파일을 가리키며 TypeScript는 대응하는 `.ts`를 검사한다. 패키지 이름과 `#core` 같은 별칭에는 확장자를 붙이지 않는다. 디렉터리 import 대신 `index.js`를 명시하고 타입만 참조할 때는 `import type`을 사용한다.

ESM 패키지 안의 CommonJS 도구는 `.cjs`, ESM 형식을 명시할 도구는 `.mjs`를 쓴다. CommonJS 패키지에서는 `.js` 도구도 CommonJS로 실행된다.

테스트의 조건과 이름·단언·자원 정리는 [테스트 작성 규칙](../tests/README.md#테스트는-한-행동의-결과를-검증한다)을 따른다.
