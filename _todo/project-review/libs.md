# libs 전체 감사 — 2026-09-26

진행할 항목은 L2의 SSE 디코딩 교체뿐이다. 나머지 발견과 수정 후보는 보류하며 이번 작업의 완료 조건에 포함하지 않는다. 작업 범위와 읽기 부담의 기준은 [진행할 작업](README.md)을 따른다.

기준: `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0`. `libs-files.json`의 162개, 12,526줄을 모두 새로 완독했다. README/AGENTS/docs/libs.md/docs/reference/conventions.md/docs/reference/decisions.md를 먼저 확인했다. 파일별 상태는 [전체 파일 목록](files.md)에 있다. 소스·설정·테스트 파일은 변경하지 않았다. 외부 인프라를 중단·초기화하거나 별도 full suite를 실행하지 않았다. 전체 검증 결과는 [통합 결과](README.md)에 있다.

검증 방식: 현재 소스와 대조한 기존 build output으로 순수 함수·서비스를 실행했다. SSE는 임시 localhost HTTP 서버에서 실제 superagent 경로를 거쳤고 서버·요청을 닫았다. NATS 서비스는 제어 가능한 async subscription을 주입했다. 실패 fixture는 원본 TS를 메모리에서 변환하고 I/O 경계만 stub했다. nullable transform은 파일을 만들지 않은 TypeScript virtual program의 strict 진단 0개까지 확인했다. 아래의 '현재 API 영향 없음/제한'은 결함 부정이 아니라 우선순위 판단 근거다.

## 발견 근거와 작업 대상

### L1 — 보류 / 확신 높음: NATS 종료 후 다음 handler가 새로 실행된다

- 위치: [libs/common/src/nats/nats-pubsub.service.ts](../../libs/common/src/nats/nats-pubsub.service.ts) 33행, `:91`, `:95`.
- 트리거: 같은 subject에 첫 async handler와 두 번째 handler를 등록한다. 첫 handler가 await 중인 상태에서 `await onModuleDestroy()`를 호출하고 첫 handler를 재개한다.
- 관찰: destroy가 반환했을 때 unsubscribe는 완료됐지만, 첫 handler를 재개한 뒤 두 번째 handler 호출 수가 0→1이 된다. Map만 비우고 소비 루프가 잡고 있는 `state.handlers`를 유지하며 task도 추적하지 않는다.
- 영향: 종료 완료 뒤 handler가 시작되거나 계속 실행되어 이미 닫힌 의존 자원을 사용할 수 있다. 현재 API subscriber는 동기 Subject 발행이므로 장시간 async 처리의 현재 API 장애로 과장하지 않는다. 공용 서비스는 async handler를 실제로 await하며 기존 테스트도 async throw를 사용한다.
- 수정 후보(보류): 종료 시 각 state의 등록 handler를 비우고 소비 task를 추적하여 종료 훅이 진행 중 task의 끝을 관찰하게 한다. 정상 경로와 종료 barrier 경로를 기존 nats spec에서 검증한다. 새 메시지 재시도나 별도 shutdown framework는 필요 없다.
- 테스트 공백: 기존 destroy 테스트는 종료 뒤 새 publish만 확인하여 이미 실행 중인 메시지의 나머지 handler를 놓친다.

### L2 — 진행 / 확신 높음: SSE 문자열이 UTF-8 바이트 경계에서 손상된다

- 위치: [libs/testing/src/http.test-client.ts](../../libs/testing/src/http.test-client.ts) 156행–`:157`.
- 트리거: `data: 한글\n\n`을 첫 '한'의 첫 UTF-8 byte 뒤에서 둘로 나누어 전송한다.
- 관찰: 실제 HTTP 서버에서 첫 data 이벤트 도착을 확인한 다음 나머지 바이트를 전송하자 `한글` 대신 `���글`을 받았다. 각 Buffer에 따로 `.toString()`을 호출하므로 부분 문자 정보가 소실된다.
- 영향: 정상 한글·emoji SSE 응답의 테스트가 네트워크 분할에 따라 실패하거나 잘못된 값을 검증한다. LF 이벤트 프레이밍 자체의 범위를 늘릴 필요는 없다.
- 최소 개선: `StringDecoder` 또는 Node stream의 `setEncoding('utf8')`로 연속 스트림 디코딩을 수행한다. 기존 fixture/spec에 UTF-8 분할을 강제하는 응답을 추가한다.
- 근거: Node 공식 문서는 StringDecoder가 chunk 사이의 불완전한 multibyte sequence를 보관함을 명시한다. [Node String decoder](https://nodejs.org/api/string_decoder.html).
- 재현 시 받은 chunks: `[100,97,116,97,58,32,237]`, `[149,156,234,184,128,10,10]`.

### L3 — 보류 / 확신 높음: 유효한 정반대 좌표의 거리가 NaN이다

- 위치: [libs/common/src/lat-long/lat-long.ts](../../libs/common/src/lat-long/lat-long.ts) 52행–`:57`.
- 트리거: from `{latitude:0.08,longitude:0}`, to `{latitude:-0.08,longitude:180}`.
- 관찰: `LatLong.distanceInMeters(from,to)`가 `NaN`이다. Haversine 중간값의 부동소수점 반올림이 1보다 커져 `sqrt(1-halfChordSquared)`가 NaN이 된다.
- 영향: 두 입력 모두 현재 좌표 검증 범위 안이다. [apps/api/src/services/application/booking/booking.utils.ts](../../apps/api/src/services/application/booking/booking.utils.ts) 22행의 거리순 정렬에서 비교가 0처럼 처리되어 거리순 결과가 틀릴 수 있다. 한국 fixture만으로는 드러나지 않는다.
- 수정 후보(보류): 수학적으로 [0,1]인 중간값을 그 구간으로 정규화한 뒤 각도를 계산한다. 기존 antipode 테스트에 해당 입력과 finite 단언을 포함한다. 지리 라이브러리 추가는 불필요하다.

### L4 — 보류 / 확신 높음: ByteUtil이 자신이 허용한 소수 바이트를 잃는다

- 위치: [libs/common/src/utils/byte.ts](../../libs/common/src/utils/byte.ts) 69행–`:77`; 왕복 계약 `:47`–`:49`.
- 트리거/관찰: `fromString('1.5B')`는 1.5를 받지만 `toString(1.5)`는 `1B`이고 재파싱 결과는 1이다. `toString(0.5)`는 빈 문자열이어서 재파싱에 실패한다. `1024.5`도 `1KB`가 되어 0.5가 사라진다.
- 영향: 선언된 왕복 계약 위반이다. 현재 앱에서 ByteUtil 직접 호출은 없어 API 회귀의 긴급도는 낮다. 물리적 파일 크기가 정수인 것과 이 parser가 소수 바이트를 받는 값 계약은 구분해야 한다.
- 수정 후보(보류): 최종 B 잔여량을 소수까지 보존한다. 기존 byte spec의 왕복 표에 양·음수 소수 바이트와 1B 미만을 포함한다. 입력을 정수로 축소하는 것은 별도 계약 결정이므로 단순 수정을 이유로 제한하지 않는다.

### L5 — 보류 / 확신 높음: NaN TTL이 영구 저장으로 바뀐다

- 위치: [libs/common/src/cache/cache.service.ts](../../libs/common/src/cache/cache.service.ts) 59행–`:69`.
- 트리거/관찰: `set('key','value',NaN)`은 음수 검사와 양수 분기를 모두 통과하지 않아 실제 Redis 호출 인자가 `['prefix:key','value']`가 된다. PX가 없어 영구 키를 저장한다.
- 영향: TTL 계산 실패가 조용히 성공한 영구 저장으로 바뀐다. 현재 API 설정은 별도 Zod 경계를 거치므로 해당 API가 NaN을 전달한다고 주장하지 않는다.
- 수정 후보(보류): 이미 오류 문구로 요구하는 유한 정수 TTL을 set 이전에 검증한다. withLock도 동일한 정수 계약과 검사 조건이 어긋나므로 함께 점검한다. `incrementWithExpiry`는 INCR 이후 PEXPIRE를 실행하므로 TTL 검사 실패는 Lua 실행 전에 해야 부분 쓰기를 피한다.
- 테스트 공백: 기존 cache spec은 음수·0·정상 양수만 다룬다.

### L6 — 보류 / 확신 높음: fixture 부분 생성 실패가 열린 자원을 남긴다

- 위치 A: [libs/common/src/nats/\_\_tests\_\_/nats-pubsub.service.fixture.ts](../../libs/common/src/nats/__tests__/nats-pubsub.service.fixture.ts) 31행 (두 번째 context 생성), `:49` (flush), `:51` (정상 반환 뒤에만 노출되는 teardown).
- 위치 B: [libs/common/src/mongodb/\_\_tests\_\_/crud.repository.fixture.ts](../../libs/common/src/mongodb/__tests__/crud.repository.fixture.ts) 104행 (connect), `:113` (index 초기화).
- 트리거: A의 contextA는 생성됐으나 contextB 생성 또는 flush가 실패한다. B의 client는 연결됐으나 onModuleInit/createIndexes가 실패한다.
- 관찰: 원본 fixture 함수를 메모리에서 실행해 I/O 실패를 주입했다. A: `createdContexts=1, closedContexts=0`; B: `connectedClients=1, closedClients=0`. 두 경우 원래 오류는 전달되지만 이미 연 자원을 닫지 않는다.
- 영향: fixture 반환 전 실패라 suite의 `fix`가 아직 없고 일반 afterEach teardown으로도 정리하지 못한다. 일시 외부 서비스 실패가 열린 연결/후속 테스트 간섭으로 확대될 수 있다.
- 수정 후보(보류): 각 fixture가 취득한 자원을 즉시 소유하고 후속 설정이 실패하면 catch/finally에서 모두 close한다. 여러 close 중 하나의 실패가 나머지 정리를 막지 않도록 settle하고 원래 setup 오류를 유지한다. 기존 파일 안의 실패 회귀 검사로 충분하다.

## 필수 작업에서 제외한 값·타입 발견

### L7 — 보류 / 확신 높음: BaseConfigService 반환 타입이 런타임에서 지켜지지 않는다

- 위치: [libs/common/src/config/base-config.service.ts](../../libs/common/src/config/base-config.service.ts) 29행, `:44`, `:54`–`:62`.
- 실제 `new ConfigService({N:null,T:true,S:123})`를 주입하면 `getNumber('N')=0`, `getNumber('T')=1`, `getString('S')=123`이다. generic 인자는 ConfigService 반환값을 검증하지 않는다.
- 영향: ConfigModule의 load/validate 결과를 재사용하는 공용 getter가 잘못된 타입을 정상 설정으로 돌려준다. 현재 AppConfig의 Zod schema가 앞서 타입을 제한하므로 현재 API 설정의 결함으로 세지 않는다.
- 수정 후보(보류): getter의 허용 입력 타입을 검사한 뒤 변환하고, string getter는 실제 string만 반환한다. 기존 config spec에 null/boolean/number 경계를 넣는다.

### L8 — 보류 / 확신 높음: nullable transform 입력을 non-null로 잘못 선언한다

- 위치: [libs/common/src/utils/mapping.ts](../../libs/common/src/utils/mapping.ts) 9행–`:12`.
- `assignIfDefined({name:''},{name:null as string|null},'name',v=>v.toUpperCase())`는 strict TypeScript에서 진단 0개지만 런타임 TypeError다. 구현은 undefined만 제외하여 null을 transform에 전달하는데 콜백 타입은 NonNullable로 null도 제거한다.
- 수정 후보(보류): transform 인자의 타입에서 undefined만 제외한다. null을 건너뛰는 런타임 변경은 기존 null 복사 계약을 바꾸므로 하지 않는다. 현재 앱의 호출은 transform을 쓰지 않아 API 영향은 없다.

### L9 — 보류 / 확신 높음: isEqual이 동일 객체를 다르다고 할 수 있다

- 위치: [libs/common/src/utils/lodash.ts](../../libs/common/src/utils/lodash.ts) 100행–`:105`, `:141`.
- 트리거: `let n=0; const x={get value(){return ++n}}; isEqual(x,x)`.
- 관찰: 결과 false, getter 호출 2회다. Node 비교 유지라는 주석과 달리 참조가 같은 경우에도 독립 snapshot 두 개를 만든다.
- 수정 후보(보류): 동일 참조/값의 비교는 Object.is로 먼저 끝낸다. 필요하면 서로 다른 객체의 getter 관찰 횟수도 별도 확인한다. Temporal/Map/Set/cycle 처리를 제거하거나 기존 선택을 되돌릴 근거는 아니다. 현재 앱의 Require.equals는 수량 비교여서 직접 영향은 없다.

### L10 — 보류 / 확신 높음: pick/pickBy가 __proto__라는 데이터 키를 잃는다

- 위치: [libs/common/src/utils/lodash.ts](../../libs/common/src/utils/lodash.ts) 58행, `:201`.
- 트리거: JSON.parse로 만든 own `__proto__` 필드를 선택한다.
- 관찰: pick 결과 own keys는 빈 배열이고 prototype이 입력 필드 값으로 바뀐다. pickBy도 해당 own key를 잃는다. countBy는 이미 Object.fromEntries로 같은 종류의 키를 보존한다.
- 영향: 일반 데이터 매핑의 키 보존 위반이다. 보안 정책 추가나 공격 가능성을 확정하는 보고가 아니다. 현재 Movies fields는 명시 DTO 필드라 직접 API 영향은 없다.
- 수정 후보(보류): 선택한 entry를 Object.fromEntries 또는 own data property 정의로 복사한다. 기존 pick/pickBy spec에서 키 보존을 확인한다.

### L11 — 보류 / 확신 높음: Require.equals의 진단 메시지가 원래 불변식 오류를 바꾼다

- 위치: [libs/common/src/utils/validator.ts](../../libs/common/src/utils/validator.ts) 39행.
- `Require.equals(1n,2n,'mismatch')` 또는 순환 객체의 불일치는 JSON.stringify에서 TypeError가 나서 의도한 InternalServerErrorException/cause에 도달하지 못한다. BigInt 쌍으로 실행 확인했다.
- 수정 후보(보류): 비교 가능한 값을 진단 가능한 표현으로 남기되 JSON 직렬화에만 의존하지 않는다. Node inspect 같은 기존 런타임 수단이면 충분하다. 현재 호출은 주로 수량이며 실제 현재 API 영향은 없다.

### L12 — 보류 / 확신 높음: TimeUtil의 아주 작은 소수 출력은 parser가 읽지 못한다

- 위치: [libs/common/src/utils/time.ts](../../libs/common/src/utils/time.ts) 31행, `:41`.
- `fromMs(0.0000001)='1e-7ms'`, `toMs('1e-7ms')`는 예외다. 일반 소수 0.001ms는 정상이다.
- 수정 후보(보류): 허용하는 number 출력과 parser의 지수 표기 정책을 일치시킨다. 현재 밀리초 timestamp/TTL 용도에서 sub-nanosecond 값은 사용하지 않으므로 새 정밀도 기능을 우선 도입할 이유는 없다.

## 결함 확정과 구분한 유지·제약 판단

- Mongo `findWithPagination`은 transaction에서 목록/count를 순차 호출하며 기존 실제 rollback 테스트가 올바르게 검증한다. 트랜잭션 없는 병렬 조회가 snapshot 일치를 보장하지 않는 것은 현재 계약이며 임의로 바꾸지 않는다.
- Mongo index 초기화 캐시는 client+namespace만 구분한다(`crud.repository.ts:135`). 같은 collection에 다른 index 선언을 가진 저장소를 추가하면 뒤 선언은 건너뛴다. 현재 API는 collection별 같은 repository/index 선언을 공유하는 설계라 실제 현재 결함으로 승격하지 않았다. 다른 선언 소유자를 도입할 때 cache key/소유권 계약을 먼저 결정해야 한다.
- Mongo ObjectId·Temporal 변환, 명시적 idFilter, hard/soft-delete 차이, aggregation `_id` 보존, session 활성기간의 제한은 코드/기존 회귀 검사와 맞는다. 모델별 query 의미를 공용 repository로 더 끌어올릴 이유는 없다.
- Auth refresh는 Lua의 세션 hash 교체, 교체된 token 409, 세션 삭제 후 늦은 refresh 401을 구분한다. 이전 refresh token으로 logout해도 같은 sessionId 전체를 지우므로 이미 회전된 세션도 회수된다. access JWT는 만료까지 유지하는 기존 계약을 새 authVersion/denylist로 바꾸지 않는다.
- JWT 경합 테스트 `jwt-auth.service.spec.ts:179`–`:187`는 barrier release가 finally에 없다. revoke/assertion이 먼저 실패하면 대기 Promise를 남길 수 있으므로 다음 테스트 수명 정리 때 finally release+settle을 권한다. 정상 동작 결함과 분리한 테스트 구조 제약이며 별도 runtime 정책은 필요 없다.
- NATS Core의 무영속 알림과 JetStream의 durable 보존·ack/redelivery/duplicate window 경계가 분리돼 있다. 테스트는 실제 서버의 ack/term advisory를 기다려 단순 flush를 처리 완료로 오해하지 않는다. subscriber fanout을 durable workflow framework로 바꾸지 않는다.
- JetStreamChannel의 초기화 Promise는 거부되면 같은 인스턴스에서 고정된다. 현재 API는 bootstrap에서 initialize하고 실패 시 앱 시작을 실패시키므로 live publish 재시도가 무조건 막힌다고 주장하지 않았다. bootstrap 소유권을 유지한다.
- Redis Cluster 생성 테스트는 mock이고 실제 cluster routing 검증이 아니라는 설명이 정확하다. 실제 API stack이 cluster의 Lua/key slot을 검증한다. lock TTL 자동 갱신·fencing은 현 보장 밖이므로 추가하지 않는다.
- Restate wrapper의 제출/출력/완료 대기, Temporal serde, attempt cancellation, endpoint HTTP/2 shutdown은 현재 기능 범위에 맞다. provider type을 공통화하거나 새 workflow engine으로 교체할 근거는 없다.
- S3 테스트의 거부 응답은 403 AccessDenied/400 BadDigest/EntityTooLarge/EntityTooSmall로 정상 정책 거부를 구분한다. 작은 binary fixture와 실제 두 업로드의 key·body·header 다운로드 검증은 의미 있는 보장을 유지한다. 하한만 지정한 POST의 1TiB sentinel은 알려진 범위이며 무제한이라고 일반화하지 않는다.
- createTestContext 자체는 configure/init/getUrl 실패의 원래 오류와 cleanup을 검증한다. `.compile()` 도중 Nest 내부 provider factory가 실패한 경우까지 별도 DI lifecycle framework를 새로 만들 필요는 이 감사에서 입증하지 못했다. 위 L6는 helper가 이미 반환한 자원을 fixture가 놓치는 명확한 경우만 지적한다.
- barrels/types/config 이름과 배치는 docs의 leaf import/runtime-adapter 경계에 맞는다. 짧은 utils 파일, 도메인 없는 mapping 위치, provider 옵션 타입을 취향으로 이동할 근거는 없다. 순수 유틸 일부 테스트가 Nest 앱 fixture를 매번 여는 비용은 있으나 현재 안정성·소유권이 명확하며 wholesale 재구성은 이 결함 수정에 필요 없다.

## 검증 제한

외부 서버 장애를 실제 서비스 중단으로 재현하지 않았다. 전체 검증 결과와 각 결함의 격리 재현을 구분한다. 타입/lint/coverage 통과는 위 값 경계와 shutdown/UTF-8 입력을 자동으로 증명하지 않는다. 새로운 dependency/test file, timeout 상향, skip, assertion 약화는 제안하지 않는다.
