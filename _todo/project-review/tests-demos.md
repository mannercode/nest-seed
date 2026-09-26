# 테스트·데모 — 보류 항목

발견 근거는 `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0` 기준이다. 아래 항목은 보류하며, [선정 기준과 재검토 조건](README.md)을 따른다.

## TD-02 — 보류: 병렬 Nest context 초기화 일부 실패 시 성공 context가 정리되지 않는다

- 위치: [apps/api/src/\_\_tests\_\_/application/purchase-events.spec.ts](../../apps/api/src/__tests__/application/purchase-events.spec.ts) 48행–`49`. 초기 teardown 목록의 수명은 `36`–`45`행도 관련된다.
- 조건: 추가 context 3개 중 하나가 초기화에 실패하고 다른 context는 생성에 성공한 경우.
- 원인: `Promise.all` 성공 뒤에만 성공한 context들의 teardown을 등록한다. 하나가 reject하면 등록 코드에 도달하지 않는다.
- 영향: 성공한 임시 앱의 HTTP/NATS/Redis 등의 자원이 살아남아, 최초 인프라 오류 뒤 테스트 종료 지연이나 다음 테스트에 영향을 줄 수 있다. beforeEach도 새 목록을 context 생성 뒤에 설정하여 첫 초기화 실패 때 undefined, 이후 실패 때 이전 목록이 남는 문제가 있다.
- 재현: 미변경 해당 테스트 callback 본문을 context factory stub으로 실행했다. 1·3번 context 성공, 2번 실패를 주입했을 때 base teardown만 호출되고 성공 context 1·3이 모두 남았다. 실제 연결은 만들지 않았다.
- 증거: `purchase-events-cleanup-reproduction.json`.
- 수정 후보(보류): beforeEach 시작에서 teardown 목록을 비운다. 추가 context 생성은 모든 결과가 settle할 때까지 기다린 후 성공 context를 정리에 등록하고, 초기화 실패가 있으면 실패를 그대로 보고한다. 단순히 생성 완료 callback에서 목록에 push만 하면 다른 생성이 끝나기 전에 afterEach가 시작할 수 있어 충분하지 않다.
- 확신: 높음. JavaScript Promise.all의 조기 rejection과 실제 callback 제어 흐름을 격리 실행해 확인했다.

## 보류한 추가 보완 후보

- [apps/api/src/\_\_tests\_\_/core/tickets.spec.ts](../../apps/api/src/__tests__/core/tickets.spec.ts) 133행의 성공 반환 검증은 `every`만 사용해 빈 배열도 참이다. 실제 저장은 purchase/aggregateSales 등의 다른 테스트가 확인하므로 전체 테스트가 판매 누락을 모두 놓친다고 주장하지 않는다. 기존 성공 case에서 요청 ID·길이를 함께 비교하면 해당 반환 계약을 직접 고정할 수 있다.
- `core/admin-auth.spec.ts:166`–`167`, `core/user-auth.spec.ts:389`–`390`의 refresh 테스트는 원 토큰과 다르다는 사실만 확인한다. 빈 응답의 undefined도 이 단언을 통과한다. common JWT 및 외부 refresh/browser 테스트가 별도로 유효 토큰 사용을 검사한다. 기존 두 API case에 문자열 필드 존재 확인을 추가하면 제목에 맞는 단언이 된다.
- `application/showtime-creation.spec.ts:509`–`555`의 정상 요청 4개 case는 같은 비싼 fixture·workflow를 각각 반복한다. saga ID·SSE 완료·상영 1개·티켓 8개를 하나의 정상 요청 case에서 모두 유지하면 3회 초기화를 줄일 수 있다. 실패나 별도 입력 사례까지 합칠 이유는 없다.
- `infrastructure/assets.spec.ts:325`–`358`은 아직 유효한 업로드를 1~2초 안에 끝내야 하는 timing 민감점이 있다. 현재 실패 재현은 하지 않았다. 변경한다면 무작정 timeout을 늘리기보다 유효 업로드 완료 후 만료 상태를 제어하는 기존 패턴을 검토할 수 있다. 실제 TTL 경과를 검증하는 별도 사례는 유지해야 한다.
- [tests/api/benchmark/crud.js](../../tests/api/benchmark/crud.js) 208행–`223`은 warmup 이후에만 지표를 넣지만 graceful-stop 구간의 완료 요청을 별도로 제외하지 않고 명목 측정 시간으로 처리량을 나눈다. 같은 조건 비교 목적에는 큰 영향이 없을 수 있으므로 결함으로 확정하지 않았다. 정밀 구간 처리량이 필요할 때는 집계 종료 경계를 정의해야 한다.
- `application/purchase.spec.ts`의 여러 barrier는 요청이 해당 hook에 도달하지 못하면 해당 Promise를 전역 테스트 timeout까지 기다린다. 뒤쪽 두 race case처럼 요청 종료와 barrier를 함께 관측하면 진단이 빨라진다. timeout을 늘릴 이유는 없다.
