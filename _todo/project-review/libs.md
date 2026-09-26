# 라이브러리 — 남은 수정과 검토

발견 근거는 `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0` 기준이다. [재사용 라이브러리 기준](../../README.md#기능코드-변경-시-주의사항)에 따라 아래 11개 결함은 수정 대상으로 둔다. 현재 API의 사용 여부와 별개로 공개 계약·값 보존·타입·자원 수명을 바로잡는다. 각 항목의 수정과 검증을 마치면 목록에서 삭제한다.

NATS 종료와 fixture 초기화 실패는 제어 가능한 I/O 대역으로 재현했다. 외부 서버 중단을 재현한 결과와 구분한다. 재현한 오류의 의미와 검증 한계는 각 항목에 남긴다.

## 수정 대상

### L1 — 미처리 / 확신 높음: NATS 종료 후 다음 handler가 새로 실행된다

- 위치: [libs/common/src/nats/nats-pubsub.service.ts](../../libs/common/src/nats/nats-pubsub.service.ts) 33행, `:91`, `:95`.
- 트리거: 같은 subject에 첫 async handler와 두 번째 handler를 등록한다. 첫 handler가 await 중인 상태에서 `await onModuleDestroy()`를 호출하고 첫 handler를 재개한다.
- 관찰: destroy가 반환했을 때 unsubscribe는 완료됐지만, 첫 handler를 재개한 뒤 두 번째 handler 호출 수가 0→1이 된다. Map만 비우고 소비 루프가 잡고 있는 `state.handlers`를 유지하며 task도 추적하지 않는다.
- 영향: 종료 완료 뒤 handler가 시작되거나 계속 실행되어 이미 닫힌 의존 자원을 사용할 수 있다. 공용 서비스는 async handler를 실제로 await하며 기존 테스트도 async throw를 사용하므로 종료 계약이 이 사용법까지 포함해야 한다.
- 수정·검증: 종료 시 각 state의 등록 handler를 비우고 소비 task를 추적하여 종료 훅이 진행 중 task의 끝을 관찰하게 한다. 정상 경로와 종료 barrier 경로를 기존 nats spec에서 검증한다. 새 메시지 재시도나 별도 shutdown framework는 필요 없다.
- 테스트 공백: 기존 destroy 테스트는 종료 뒤 새 publish만 확인하여 이미 실행 중인 메시지의 나머지 handler를 놓친다.

### L3 — 미처리 / 확신 높음: 유효한 정반대 좌표의 거리가 NaN이다

- 위치: [libs/common/src/lat-long/lat-long.ts](../../libs/common/src/lat-long/lat-long.ts) 52행–`:57`.
- 트리거: from `{latitude:0.08,longitude:0}`, to `{latitude:-0.08,longitude:180}`.
- 관찰: `LatLong.distanceInMeters(from,to)`가 `NaN`이다. Haversine 중간값의 부동소수점 반올림이 1보다 커져 `sqrt(1-halfChordSquared)`가 NaN이 된다.
- 영향: 두 입력 모두 현재 좌표 검증 범위 안이다. [apps/api/src/services/application/booking/booking.utils.ts](../../apps/api/src/services/application/booking/booking.utils.ts) 22행의 거리순 정렬에서 비교가 0처럼 처리되어 거리순 결과가 틀릴 수 있다. 한국 fixture만으로는 드러나지 않는다.
- 수정·검증: 수학적으로 [0,1]인 중간값을 그 구간으로 정규화한 뒤 각도를 계산한다. 기존 antipode 테스트에 해당 입력과 finite 단언을 포함한다. 지리 라이브러리 추가는 불필요하다.

### L4 — 미처리 / 확신 높음: ByteUtil이 자신이 허용한 소수 바이트를 잃는다

- 위치: [libs/common/src/utils/byte.ts](../../libs/common/src/utils/byte.ts) 69행–`:77`; 왕복 계약 `:47`–`:49`.
- 트리거/관찰: `fromString('1.5B')`는 1.5를 받지만 `toString(1.5)`는 `1B`이고 재파싱 결과는 1이다. `toString(0.5)`는 빈 문자열이어서 재파싱에 실패한다. `1024.5`도 `1KB`가 되어 0.5가 사라진다.
- 영향: 선언된 왕복 계약 위반이다. 물리적 파일 크기가 정수인 것과 이 parser가 소수 바이트를 받는 값 계약은 구분해야 한다.
- 수정·검증: 최종 B 잔여량을 소수까지 보존한다. 기존 byte spec의 왕복 표에 양·음수 소수 바이트와 1B 미만을 포함한다. 입력을 정수로 축소하는 것은 별도 계약 결정이므로 단순 수정을 이유로 제한하지 않는다.

### L5 — 미처리 / 확신 높음: NaN TTL이 영구 저장으로 바뀐다

- 위치: [libs/common/src/cache/cache.service.ts](../../libs/common/src/cache/cache.service.ts) 59행–`:69`.
- 트리거/관찰: `set('key','value',NaN)`은 음수 검사와 양수 분기를 모두 통과하지 않아 실제 Redis 호출 인자가 `['prefix:key','value']`가 된다. PX가 없어 영구 키를 저장한다.
- 영향: TTL 계산 실패가 조용히 성공한 영구 저장으로 바뀐다. 소비 프로젝트의 사전 검증에 기대지 않고 공용 TTL 계약을 지켜야 한다.
- 수정·검증: 이미 오류 문구로 요구하는 유한 정수 TTL을 set 이전에 검증한다. withLock도 동일한 정수 계약과 검사 조건이 어긋나므로 함께 점검한다. `incrementWithExpiry`는 INCR 이후 PEXPIRE를 실행하므로 TTL 검사 실패는 Lua 실행 전에 해야 부분 쓰기를 피한다.
- 테스트 공백: 기존 cache spec은 음수·0·정상 양수만 다룬다.

### L6 — 미처리 / 확신 높음: fixture 부분 생성 실패가 열린 자원을 남긴다

- 위치 A: [libs/common/src/nats/\_\_tests\_\_/nats-pubsub.service.fixture.ts](../../libs/common/src/nats/__tests__/nats-pubsub.service.fixture.ts) 31행 (두 번째 context 생성), `:49` (flush), `:51` (정상 반환 뒤에만 노출되는 teardown).
- 위치 B: [libs/common/src/mongodb/\_\_tests\_\_/crud.repository.fixture.ts](../../libs/common/src/mongodb/__tests__/crud.repository.fixture.ts) 104행 (connect), `:113` (index 초기화).
- 트리거: A의 contextA는 생성됐으나 contextB 생성 또는 flush가 실패한다. B의 client는 연결됐으나 onModuleInit/createIndexes가 실패한다.
- 관찰: 원본 fixture 함수를 메모리에서 실행해 I/O 실패를 주입했다. A: `createdContexts=1, closedContexts=0`; B: `connectedClients=1, closedClients=0`. 두 경우 원래 오류는 전달되지만 이미 연 자원을 닫지 않는다.
- 영향: fixture 반환 전 실패라 suite의 `fix`가 아직 없고 일반 afterEach teardown으로도 정리하지 못한다. 일시 외부 서비스 실패가 열린 연결/후속 테스트 간섭으로 확대될 수 있다.
- 수정·검증: 각 fixture가 취득한 자원을 즉시 소유하고 후속 설정이 실패하면 catch/finally에서 모두 close한다. 여러 close 중 하나의 실패가 나머지 정리를 막지 않도록 settle하고 원래 setup 오류를 유지한다. 기존 파일 안의 실패 회귀 검사로 충분하다.

### L7 — 미처리 / 확신 높음: BaseConfigService 반환 타입이 런타임에서 지켜지지 않는다

- 위치: [libs/common/src/config/base-config.service.ts](../../libs/common/src/config/base-config.service.ts) 29행, `:44`, `:54`–`:62`.
- 실제 `new ConfigService({N:null,T:true,S:123})`를 주입하면 `getNumber('N')=0`, `getNumber('T')=1`, `getString('S')=123`이다. generic 인자는 ConfigService 반환값을 검증하지 않는다.
- 영향: ConfigModule의 load/validate 결과를 재사용하는 공용 getter가 잘못된 타입을 정상 설정으로 돌려준다. 소비 프로젝트가 별도 Zod 검증을 두지 않아도 getter의 반환 타입을 신뢰할 수 있어야 한다.
- 수정·검증: getter의 허용 입력 타입을 검사한 뒤 변환하고, string getter는 실제 string만 반환한다. 기존 config spec에 null/boolean/number 경계를 넣는다.

### L8 — 미처리 / 확신 높음: nullable transform 입력을 non-null로 잘못 선언한다

- 위치: [libs/common/src/utils/mapping.ts](../../libs/common/src/utils/mapping.ts) 9행–`:12`.
- `assignIfDefined({name:''},{name:null as string|null},'name',v=>v.toUpperCase())`는 strict TypeScript에서 진단 0개지만 런타임 TypeError다. 구현은 undefined만 제외하여 null을 transform에 전달하는데 콜백 타입은 NonNullable로 null도 제거한다.
- 수정·검증: transform 인자의 타입에서 undefined만 제외한다. null을 건너뛰는 런타임 변경은 기존 null 복사 계약을 바꾸므로 하지 않는다.

### L9 — 미처리 / 확신 높음: isEqual이 동일 객체를 다르다고 할 수 있다

- 위치: [libs/common/src/utils/lodash.ts](../../libs/common/src/utils/lodash.ts) 100행–`:105`, `:141`.
- 트리거: `let n=0; const x={get value(){return ++n}}; isEqual(x,x)`.
- 관찰: 결과 false, getter 호출 2회다. Node 비교 유지라는 주석과 달리 참조가 같은 경우에도 독립 snapshot 두 개를 만든다.
- 수정·검증: 동일 참조/값의 비교는 Object.is로 먼저 끝낸다. 필요하면 서로 다른 객체의 getter 관찰 횟수도 별도 확인한다. Temporal/Map/Set/cycle 처리를 제거하거나 기존 선택을 되돌릴 근거는 아니다.

### L10 — 미처리 / 확신 높음: pick/pickBy가 __proto__라는 데이터 키를 잃는다

- 위치: [libs/common/src/utils/lodash.ts](../../libs/common/src/utils/lodash.ts) 58행, `:201`.
- 트리거: JSON.parse로 만든 own `__proto__` 필드를 선택한다.
- 관찰: pick 결과 own keys는 빈 배열이고 prototype이 입력 필드 값으로 바뀐다. pickBy도 해당 own key를 잃는다. countBy는 이미 Object.fromEntries로 같은 종류의 키를 보존한다.
- 영향: 일반 데이터 매핑의 키 보존 위반이다. 보안 정책 추가나 공격 가능성을 확정하는 보고가 아니다.
- 수정·검증: 선택한 entry를 Object.fromEntries 또는 own data property 정의로 복사한다. 기존 pick/pickBy spec에서 키 보존을 확인한다.

### L11 — 미처리 / 확신 높음: Require.equals의 진단 메시지가 원래 불변식 오류를 바꾼다

- 위치: [libs/common/src/utils/validator.ts](../../libs/common/src/utils/validator.ts) 39행.
- `Require.equals(1n,2n,'mismatch')` 또는 순환 객체의 불일치는 JSON.stringify에서 TypeError가 나서 의도한 InternalServerErrorException/cause에 도달하지 못한다. BigInt 쌍으로 실행 확인했다.
- 수정·검증: 비교 가능한 값을 진단 가능한 표현으로 남기되 JSON 직렬화에만 의존하지 않는다. Node inspect 같은 기존 런타임 수단이면 충분하다.

### L12 — 미처리 / 확신 높음: TimeUtil의 아주 작은 소수 출력은 parser가 읽지 못한다

- 위치: [libs/common/src/utils/time.ts](../../libs/common/src/utils/time.ts) 31행, `:41`.
- `fromMs(0.0000001)='1e-7ms'`, `toMs('1e-7ms')`는 예외다. 일반 소수 0.001ms는 정상이다.
- 수정·검증: 허용하는 number 출력과 parser의 지수 표기 정책을 일치시킨다. 생성한 문자열을 다시 읽는 기존 왕복 계약을 검증한다. 입력 범위를 임의로 줄여 통과시키지 않는다.

## 추가 재검토 조건

- Mongo index 초기화 캐시는 client+namespace만 구분한다(`crud.repository.ts:135`). 같은 collection에 다른 index 선언을 가진 저장소를 추가하면 뒤 선언은 건너뛴다. 여러 저장소의 서로 다른 선언을 지원할지와 초기화 소유권이 공개 계약으로 명확하지 않다. 이 사용법을 지원한다면 뒤 선언도 초기화하도록 cache key·소유권을 맞춰야 한다.
- JWT 경합 테스트 `jwt-auth.service.spec.ts:179`–`:187`는 barrier release가 finally에 없다. revoke/assertion이 먼저 실패하면 대기 Promise를 남길 수 있으므로 다음 테스트 수명 정리 때 finally release+settle을 권한다. 정상 동작 결함과 분리한 테스트 구조 제약이며 별도 runtime 정책은 필요 없다.

- 순수 유틸 일부 테스트가 Nest 앱 fixture를 매번 여는 비용은 있다. 현재 안정성·소유권이 명확하므로 실제 비용을 확인할 때 필요한 범위만 판단한다.
