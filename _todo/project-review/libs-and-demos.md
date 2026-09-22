# libs/와 데모 검토 결과

최초 검토 범위는 `libs/`, `apps/console/`, `apps/user-app/`의 추적 파일 193개, 14,164줄 전체다. 런타임·타입·barrel·설정·테스트·fixture를 모두 읽었다. 아래 근거는 당시 소스 검토와 inline 재현이며, 후속 반영 상태를 항목별로 표시한다. 검증 결과는 [통합 목록](README.md)에 둔다.

## 판단

- 런타임 common에는 영화·극장·구매 같은 API 도메인 구현이나 Next.js BFF가 없다. SDK 실행·연결 수명, 직렬화, 인증 도구, 날짜·좌표·페이지네이션을 둔 현재 경계는 대체로 적절하다. 테스트의 영화 모양 샘플 데이터는 API import나 런타임 결합이 아니다.
- 두 데모의 화면은 작은 폼·목록·홈 읽기 조합으로 구성돼 있다. 상태관리 프레임워크나 별도 도메인 계층을 추가할 이유가 없다. UI 복제를 없애겠다고 common frontend 패키지를 만드는 방향도 권하지 않는다.
- 실제 개선점은 거대한 새 구조가 필요한 문제가 아니라, 기존 유틸의 잘못된 결과·모호한 계약, 일부 테스트의 과도한 비용, BFF 한 군데의 불필요한 콜백 추상화다.

## 재현하거나 코드로 확인한 문제

### 1. 중첩된 Temporal 값을 `isEqual`이 같다고 판정한다

상태: 완료. Node의 엄격한 비교를 유지하면서 열거 가능한 속성·배열·Map·Set의 Temporal 값과 달력·참조 날짜를 비교 자료에 포함한다. 순환 참조와 프로토타입도 보존하며 새 비교 패키지를 추가하지 않았다.

근거: `libs/common/src/utils/lodash.ts:97`, `:110`.

최상위 Temporal만 `equals`를 호출하고 객체·배열은 Node `isDeepStrictEqual`에 위임한다. Node 26.8.2의 실제 실행 결과:

```text
isEqual(Instant(0), Instant(1))             → false
isEqual({ at: Instant(0) }, { at: Instant(1) }) → true
isEqual([Instant(0)], [Instant(1)])         → true
```

범용 비교 함수의 계약 결함이다. 현재 API의 `Require.equals` 사용은 삽입 수 비교여서 이것을 구매 정합성 사고나 인증 결함으로 주장할 근거는 없다. 현재 테스트는 최상위 Temporal과 일반 중첩 객체를 따로 검사해 조합을 놓친다. 새로운 범용 deep-equality 엔진을 만들기 전에, 이 함수가 보장할 입력 범위를 정하고 기존 비교 도구 또는 명시적 DTO 비교로 최소 수정해야 한다.

### 2. 음수 복합 시간의 표시와 파싱이 서로 다르다

상태: 완료. 기존 항목별 부호 문법을 유지하고 `fromMs`도 `-1h-30m`으로 출력한다. 양수·음수 복합 시간과 소수 밀리초의 왕복 변환을 검증한다.

근거: `libs/common/src/utils/time.ts:33`, `:49`, `:70`.

```text
TimeUtil.fromMs(-5_400_000)             → '-1h30m'
TimeUtil.toMs('-1h30m')                → -1_800_000
```

표시는 전체 값에 음수 부호를 붙이지만 파서는 항목별 부호로 합산한다. 음수 지원은 이미 공개 주석·테스트에 있으므로 새 엣지 케이스 기능을 만드는 문제가 아니다. `ByteUtil`처럼 각 항목에 부호를 붙이거나 전체 부호 문법으로 파서를 정해야 한다. 현재 API는 양수 설정의 `toMs`만 사용하며 운영 코드의 `fromMs` 사용처는 찾지 못했다. 우선순위는 현재 API 결함보다 낮다.

### 3. 해시가 없는 비밀번호 검증이 특정 입력에 성공한다

상태: 완료. dummy 비교를 수행해도 저장된 해시가 없으면 false를 반환한다. dummy 원문도 인증 성공을 만들지 않으며 기존 Users/Admins의 계정 존재 확인은 유지한다.

근거: `libs/common/src/auth/password.ts:5`, `:12`; `libs/common/src/auth/__tests__/guards.spec.ts:157`.

`PasswordHasher.verify('timing-equalization-only', undefined)`가 true다. 기존 테스트도 이를 기대한다. timing dummy 비교 결과를 그대로 인증 결과처럼 반환하기 때문이다. 현재 Users/Admins 인증은 `user && isValid` / `admin && isValid`를 확인하므로 **현재 API 인증 우회는 아니다**.

재사용 함수의 계약은 해시가 없으면 실패가 자연스럽다. dummy 비교를 유지하더라도 결과는 false로 반환하면 된다. 더 강한 인증 장치나 새로운 계정 잠금 정책을 추가할 이유는 없다.

### 4. `Env`는 잘못된 설정을 정상 값으로 바꾼다

상태: 완료. 불리언은 대소문자를 무시한 true·false만 허용하고, 숫자의 공백·비유한 값은 예외로 거절한다. 기존 wrapper와 필수 env 오류 방식은 유지한다.

근거: `libs/common/src/utils/env.ts:4`, `:13`; `libs/common/src/config/base-config.service.ts:7`.

`Env.getBoolean`은 `tru`, `yes`, `1` 등 모든 비어 있지 않은 비-true 문자열을 false로 만든다. `getNumber`는 공백 문자열을 0으로 만든다. 이 동작을 기존 env 테스트 일부가 고정하고 있다. 반면 `BaseConfigService`와 현재 API Zod 설정은 잘못된 값을 거절한다.

현재 API 런타임에서 `Env.getBoolean/getNumber` 사용처는 없다. 재사용 helper와 문서의 '설정 오류를 그 자리에서 실패시킨다' 원칙을 맞추는 후보다. 기존 Env 래퍼는 유지하고 허용 문법만 명확하게 정하면 된다. API env 로딩을 다시 만드는 작업은 아니다.

### 5. `countBy`는 일반 객체의 상속된 속성명에서 숫자를 반환하지 않는다

상태: 완료. Map으로 집계한 뒤 일반 객체로 반환한다. `constructor`·`__proto__`·`toString`도 독립적인 own key와 숫자 개수를 갖는다.

근거: `libs/common/src/utils/lodash.ts:135`.

`countBy(['constructor', 'constructor'])`의 결과는 `{ constructor: 'function Object() { [native code] }11' }`이다. `Record<string, number>` 계약과 다르다. 문자열 키 집계는 Map 또는 own-key 사전을 쓰면 작은 변경으로 해결할 수 있다. 이를 근거로 저장소 전역 보안 프레임워크를 도입할 이유는 없다. 현재 API의 `application/recommendation/domain/movie-recommender.ts:10`에서 사용한다. 입력이 제한된 MovieGenre enum이므로 위 속성명은 현재 추천 경로에서 나오지 않는다.

### 6. 동시에 등록한 NATS 구독자가 같은 준비 완료를 기다리지 않는다

상태: 완료. 같은 subject·queue는 준비 Promise를 공유하고, 각 핸들러를 등록 순서대로 연결한 뒤 함께 기다린다. 준비 실패는 모든 호출자에게 전달하며 실패한 구독을 정리한다. 실제 NATS 연결에서 준비 지연·실패·다음 명시적 구독을 검증했다.

근거: `libs/common/src/nats/nats-pubsub.service.ts:50`–`:61`.

첫 호출은 state를 등록한 뒤 flush를 기다리지만 같은 subject/queue의 두 번째 호출은 state가 있으므로 즉시 반환한다. 실제 NATS 연결에서 첫 flush를 제어한 재현 결과, 두 번째 `subscribe`가 반환할 때 첫 flush는 아직 완료되지 않았다. 첫 핸들러도 flush 뒤에 등록되므로 그 사이의 메시지는 두 번째 핸들러에게만 전달됐다.

첫 호출이 아직 완료되지 않은 동안 첫 핸들러가 못 받았다는 사실만으로 메시지 보장 위반이라고 단정하면 안 된다. 확인된 문제는 **모든 subscribe 반환이 서버의 SUB 처리 확인을 뜻한다는 현재 주석·테스트 설명이 동시 등록에 성립하지 않는다**는 점이다. 현재 API는 기동 시 상영 이벤트 핸들러 하나를 등록한다. 현재 SSE 장애를 재현한 것은 아니다.

보장을 유지한다면 state에 동일한 준비 Promise를 두고 각 등록이 이를 기다리게 하는 작은 수정이 적절하다. 메모리 재전달·자동 복구 루프·상태 저장소를 추가할 문제는 아니다.

## 시드 범위를 넘어선 비용과 불필요한 구조

### S3 테스트의 데이터 양과 호출 수

- `libs/common/src/s3/__tests__/s3-object.service.spec.ts:596`: 매번 다른 key인지 확인하려고 실제 S3 `putObject`를 200회 동시에 수행한다. UUID 함수 자체의 형식·중복 확인은 `utils/__tests__/id.spec.ts`에도 있다. 소수의 서로 다른 내용 저장과 다운로드 확인으로 wrapper의 핵심 계약을 더 직접 검증할 수 있다. 성능·부하 테스트라는 별도 목적도 없다.
- `libs/common/src/s3/__tests__/s3-object.service.fixture.ts:54`: HEAD·content type·length 비교용 데이터가 10MiB이고 여러 테스트에서 반복 업로드한다. 해당 조건에 큰 파일이 필요하지 않다. 작은 고정 binary fixture면 충분하다. 단순히 검사 통과를 위해 assertions나 coverage를 낮추자는 제안이 아니다.
- 같은 S3 spec의 기존 '업로드 거부' 시나리오들은 `response.ok === false`만 확인한다. 저장소 500/503도 정책 거부를 검증했다고 통과한다. 현재 시나리오에서 실제 provider가 반환하는 정상 거부 상태를 확인해 assertion을 구체화하면 된다. 새 실패 행렬이나 새 테스트 파일은 필요하지 않다.

### 타입·파일 배치

- `libs/common/src/mongodb/mongo.util.ts:103`: `QueryBuilder<_T>`의 `_T`를 어디에도 쓰지 않으며 field는 string, value는 any다. `new QueryBuilder<User>()`가 필드·값 타입을 검사한다는 인상만 준다. **사용하지 않는 제네릭 제거**가 가장 작은 개선이다. 엄격한 범용 Mongo 쿼리 DSL로 확장하는 것은 권하지 않는다.
- `mongo.util.ts:161`의 `assignIfDefined`, `:172`의 `mapDocToDto`는 MongoDB와 관계없는 필드·스키마 변환이다. common에 남기는 것은 맞지만 `utils` 아래가 더 찾기 쉽다. API 전용 코드로 옮겨야 할 근거는 없다.
- `libs/common/src/auth/jwt-auth.types.ts:20`의 `JwtAuthTokens`는 생성하지 않는 데이터 클래스다. type으로 표현할 수 있으나, 이것만을 위한 큰 리팩터링의 가치는 낮다.
- `libs/common/src/health/__tests__/redis.health-indicator.spec.ts`에 Mongo indicator 테스트가 섞여 있고 `restate-endpoint.service.spec.ts`/`restate-workflow-client.service.spec.ts`는 현재 클래스명에 없는 Service를 갖는다. 파일 찾기를 위해 다음 관련 수정 때 이름을 맞추는 수준이면 된다.
- `InjectNatsPubSub`가 function인지, dynamic module의 provider 수가 1인지 등의 단위 단언은 실제 Nest 주입 통합 경로보다 가치가 낮다. 같은 계약을 통합 검증에서 보장하는 경우 정리할 수 있으나 공통 SDK adapter 테스트를 일괄 삭제할 근거는 아니다.

### 데모 BFF의 작은 정리 후보

`apps/console/src/lib/bff-proxy.ts:44`와 user-app 동일 파일의 `retryWithRotatedSession<Response>`는 각 앱의 route 한 곳에서만 쓴다. response 생성·retry·cookie setter 세 콜백을 전달하는 제네릭 helper 대신 해당 route에서 try/catch 후 새 cookie를 쓰면 동작이 더 직접 드러난다. 외부 common으로 다시 옮기지 않는다.

두 route의 310줄을 이유 없이 모두 지워서는 안 된다. cookie 발급/만료, refresh 후 원 요청 한 번 재시도, logout은 현재 로그인 데모의 실제 기능이다. 현재 보장인 body 제한·same-origin·IP opt-in·동시 refresh 합치기를 없애는 것은 별도 정책 결정이다. 인증 자체를 바꾸거나 보안을 더 얹는 제안은 하지 않는다.

첫 upstream fetch 실패가 route 밖으로 throw되어 framework 500/HTML이 될 수 있는 점(`route.ts:87`)과 브라우저 API client가 JSON.parse부터 하는 점은 데모 오류 표시의 일관성 개선 후보다. 현재 성공 경로를 막는 문제가 아니며 사용자와 이미 비필수로 분류했던 작업이다. 이번 감사가 이를 새 필수 기능으로 바꾸지는 않는다.

## 이름 검토

모든 파일과 선언을 읽되 이름을 바꾸는 것 자체를 목표로 삼지 않았다.

| 대상                                                                              | 판단                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AuthGuard`, `JwtVerifier`, `JwtAuthService`, `PasswordHasher`                    | 역할이 드러난다. verify의 동작 계약을 먼저 고쳐야 한다.                                                                  |
| `revokeAllForUser`                                                                | admin도 쓰는 common API라 `revokeAllSessions(subjectId)`가 더 일반적이다. 호출부 변경 비용 대비 선택적 개선이다.         |
| `CacheService`, `withLock`, `withLockBlocking`, `executeScript`                   | 현재 경계와 기다림 여부를 설명한다. CacheService를 여러 작은 service로 분해할 필요는 없다.                               |
| `CrudRepository`, `idFilter`, `idsFilter`, `find/get`, `findWithPagination`       | 현재 계약에 맞는다. ById 제거를 위해 조건 분기를 합칠 이유가 없다.                                                       |
| `MongoConnection`, `MongoTransactionRepository`, `TransactionContext`             | 기술 구현과 전달 경계가 명확하다. DB 교체를 보장하는 이름은 아니다.                                                      |
| `QueryBuilder<_T>`                                                                | 이름보다 무효한 제네릭이 문제다. MongoQueryBuilder로의 개명은 선택사항이다.                                              |
| `NatsPubSubService`, `JetStreamChannel`, `DurableMessage`                         | 비영속 pub/sub과 ack 채널이 구분된다.                                                                                    |
| `RestateEndpoint`, `RestateWorkflowClient`, `defineWorkflow`, `TemporalJsonSerde` | 업무와 SDK 실행 경계를 구분한다. generic saga framework로 확장하지 않는다.                                               |
| `S3ObjectService`, `presignUploadPost`, `isUploadComplete`                        | S3 의미를 숨기지 않고 드러낸다. upload complete는 object 존재/metadata 일치 확인이라는 JSDoc을 유지한다.                 |
| `HttpTestClient.agent`                                                            | 실제 타입은 superagent.Request다. `request`/`currentRequest`가 더 정확하다. 상태를 공유하는 builder라는 사실도 드러난다. |
| `ModuleMetadataEx`                                                                | 무엇을 확장했는지 불분명하므로 `TestModuleOptions`가 더 읽기 쉽다. 기능 변경은 필요 없다.                                |
| 데모 `HomePage`, `NewMoviePage`, `NewTheaterPage`, `api-client`, `bff-proxy`      | 규모와 실제 역할에 맞는다. 작은 로컬 `e`, `err`, `g`, `r` 등을 이름 규칙만으로 모두 바꾸지 않는다.                       |

## 유지하는 선택과 과장하지 않을 사항

- generateUuid·PathUtil·날짜/시간/JSON 등의 기존 wrapper는 재사용성과 발견 가능성 때문에 유지한다. 낮은 사용량만으로 삭제하지 않는다.
- 현재 common은 모든 연동 peer dependency를 한 패키지로 제공한다. 이것은 분리된 소형 npm 패키지 모음이 아니라 Nest 프로젝트용 공통 패키지다. 실제 다른 소비 프로젝트의 부담이 확인되기 전에 subpackage 체계를 새로 만들지 않는다.
- JWT에는 authVersion이나 즉시 액세스 토큰 회수 장치가 없다. 현행 회전 hash·Redis 원자 연산은 기본 로그인 계약을 지키는 데 필요하다. Redis 개별 명령 실패 확인도 보안 과잉이 아니다.
- Restate/JetStream은 SDK 실행을 common에, 업무 단계·이벤트 내용·보존 정책을 앱에 두고 있다. 현재 역할 분리는 타당하다.
- API integration 우선, 100% coverage, 기존 단건/다건 계약은 사용자 결정이다. 테스트 수만 세어 이를 완화하지 않는다.
- Mongo `findWithPagination`은 transaction을 받으면서 같은 session에 Promise.all을 쓴다. 현재 API 호출부는 transaction을 전달하지 않는다. 드라이버의 동시 session 작업 계약과 비교해야 하는 후속 검토 후보이며 이번에 실행 결함으로 확정하지 않았다.
- `HttpTestClient.sse()`의 준비 콜백과 API fixture의 전용 client·요청 순서는 [T1](tests.md#t1-상영-완료-sse-구독이-요청보다-늦게-시작한다)에서 반영됐다. 일반 SSE parser를 새로 구현하는 방향으로 확대하지 않았다.
