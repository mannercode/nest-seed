# tests · demos 전체 감사

- 기준: HEAD `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0`, 2026-09-26.
- 범위: `tests_demos-files.json`의 90개 파일. 텍스트 89개 13,197줄을 모두 새로 읽었고, binary PNG 1개는 전체 bytes hash와 header metadata를 확인했다. 샘플 읽기로 전체 검토를 대체하지 않았다.
- 선행 지침: README, AGENTS, docs/apps.md, docs/tests.md, docs/reference/conventions.md, docs/reference/decisions.md.
- 저장소 수정·새 테스트 파일·인프라 reset·서비스 stop·AtoZ 실행은 하지 않았다. 이 보고서와 ledger, 격리 재현 결과만 /tmp에 작성했다.
- 파일별 기록: [전체 파일 목록](files.md)에 전체 읽음, 검증 방법과 판정을 모았다.

## 확인된 발견

### TD-01 — P2: 구매 overlap 검증이 잘못된 부분/과다 판매를 성공으로 판정한다

- 위치: [tests/api/race/purchase-overlap-race.js](../../tests/api/race/purchase-overlap-race.js) 81행–`84`; 요청 묶음은 같은 파일 `133`행에 이미 보존한다.
- 조건: `[t1,t2]` 요청이 201을 반환했지만 실제 응답·저장 이력·티켓 상태가 `[t2]` 한 장 또는 `[t1,t2,t3]` 세 장으로 잘못 반영된 경우.
- 원인: 예상 Sold 집합을 원 요청 대신 `winner.body.purchaseItems`로 만든다. 이력도 승자의 ID와 해당 triple을 건드리는 기록 수만 비교한다.
- 영향: 주석의 “Sold 티켓 두 장”과 docs/tests의 요청 묶음 의미를 확인하지 못한다. 부분 성공이나 요청 밖 판매가 발생해도 race가 PASS할 수 있다. 실제 API에서 이 오동작을 관측한 것은 아니고 검증의 false positive를 확인한 것이다.
- 재현: 미변경 `verifyGroup` 전체를 VM에서 평가하고 HTTP request 경계만 stub했다. 정상 두 장, 잘못된 한 장, 잘못된 세 장이 모두 PASS했다. 실 서비스나 DB를 변경하지 않았다.
- 증거: `purchase-overlap-reproduction.json`.
- 최소 수정: 승자에게 연결된 원 요청 티켓 배열을 보존하고, 성공 응답과 완료 이력의 티켓 목록이 그 배열과 정확히 같은지 단언한다. 티켓 상태의 기대값도 원 요청 배열에서 만든다. 기존 파일 안에서 수정 가능하다.
- 확신: 높음. 실행한 현재 검증 함수가 두 잘못된 결과를 실제로 통과시켰다.

### TD-02 — P2: 병렬 Nest context 초기화 일부 실패 시 성공 context가 정리되지 않는다

- 위치: [apps/api/src/\_\_tests\_\_/application/purchase-events.spec.ts](../../apps/api/src/__tests__/application/purchase-events.spec.ts) 48행–`49`. 초기 teardown 목록의 수명은 `36`–`45`행도 관련된다.
- 조건: 추가 context 3개 중 하나가 초기화에 실패하고 다른 context는 생성에 성공한 경우.
- 원인: `Promise.all` 성공 뒤에만 성공한 context들의 teardown을 등록한다. 하나가 reject하면 등록 코드에 도달하지 않는다.
- 영향: 성공한 임시 앱의 HTTP/NATS/Redis 등의 자원이 살아남아, 최초 인프라 오류 뒤 테스트 종료 지연이나 다음 테스트에 영향을 줄 수 있다. beforeEach도 새 목록을 context 생성 뒤에 설정하여 첫 초기화 실패 때 undefined, 이후 실패 때 이전 목록이 남는 문제가 있다.
- 재현: 미변경 해당 테스트 callback 본문을 context factory stub으로 실행했다. 1·3번 context 성공, 2번 실패를 주입했을 때 base teardown만 호출되고 성공 context 1·3이 모두 남았다. 실제 연결은 만들지 않았다.
- 증거: `purchase-events-cleanup-reproduction.json`.
- 최소 수정: beforeEach 시작에서 teardown 목록을 비운다. 추가 context 생성은 모든 결과가 settle할 때까지 기다린 후 성공 context를 정리에 등록하고, 초기화 실패가 있으면 실패를 그대로 보고한다. 단순히 생성 완료 callback에서 목록에 push만 하면 다른 생성이 끝나기 전에 afterEach가 시작할 수 있어 충분하지 않다.
- 확신: 높음. JavaScript Promise.all의 조기 rejection과 실제 callback 제어 흐름을 격리 실행해 확인했다.

## 보완할 수 있으나 현재 확정 결함과 구분할 사항

- [apps/api/src/\_\_tests\_\_/core/tickets.spec.ts](../../apps/api/src/__tests__/core/tickets.spec.ts) 133행의 성공 반환 검증은 `every`만 사용해 빈 배열도 참이다. 실제 저장은 purchase/aggregateSales 등의 다른 테스트가 확인하므로 전체 테스트가 판매 누락을 모두 놓친다고 주장하지 않는다. 기존 성공 case에서 요청 ID·길이를 함께 비교하면 해당 반환 계약을 직접 고정할 수 있다.
- `core/admin-auth.spec.ts:166`–`167`, `core/user-auth.spec.ts:389`–`390`의 refresh 테스트는 원 토큰과 다르다는 사실만 확인한다. 빈 응답의 undefined도 이 단언을 통과한다. common JWT 및 외부 refresh/browser 테스트가 별도로 유효 토큰 사용을 검사한다. 기존 두 API case에 문자열 필드 존재 확인을 추가하면 제목에 맞는 단언이 된다.
- `application/showtime-creation.spec.ts:509`–`555`의 정상 요청 4개 case는 같은 비싼 fixture·workflow를 각각 반복한다. saga ID·SSE 완료·상영 1개·티켓 8개를 하나의 정상 요청 case에서 모두 유지하면 3회 초기화를 줄일 수 있다. 실패나 별도 입력 사례까지 합칠 이유는 없다.
- `infrastructure/assets.spec.ts:325`–`358`은 아직 유효한 업로드를 1~2초 안에 끝내야 하는 timing 민감점이 있다. 현재 실패 재현은 하지 않았다. 변경한다면 무작정 timeout을 늘리기보다 유효 업로드 완료 후 만료 상태를 제어하는 기존 패턴을 검토할 수 있다. 실제 TTL 경과를 검증하는 별도 사례는 유지해야 한다.
- [tests/api/benchmark/crud.js](../../tests/api/benchmark/crud.js) 208행–`223`은 warmup 이후에만 지표를 넣지만 graceful-stop 구간의 완료 요청을 별도로 제외하지 않고 명목 측정 시간으로 처리량을 나눈다. 같은 조건 비교 목적에는 큰 영향이 없을 수 있으므로 결함으로 확정하지 않았다. 정밀 구간 처리량이 필요할 때는 집계 종료 경계를 정의해야 한다.
- `application/purchase.spec.ts`의 여러 barrier는 요청이 해당 hook에 도달하지 못하면 해당 Promise를 전역 테스트 timeout까지 기다린다. 뒤쪽 두 race case처럼 요청 종료와 barrier를 함께 관측하면 진단이 빨라진다. timeout을 늘릴 이유는 없다.

## 좌석 모델 교차 확인

- [API 검토](api.md)에서 확인한 중복 block/row 이름 문제와 별개로, 0좌석은 현재 명시된 허용 동작이다.
- `services/core/theaters/models/__tests__/seatmap.spec.ts:30`–`42`는 빈 blocks·전부 X를 0으로 기대하고, `80`–`83`은 빈 좌표 목록을 기대한다.
- `src/__tests__/core/theaters.spec.ts:70`–`79`도 `seatmap.blocks=[]` PATCH의 성공을 기대한다. 따라서 0좌석 자체를 필수 결함으로 분류하지 않았다.
- Seatmap·theaters·showtime-creation·tickets 테스트에는 중복 block/row 이름에 따른 동일 좌표 중복 생성 사례가 없다. 티켓 core fixture는 ID 중심 검증을 위해 같은 좌표를 반복 사용하므로 application 좌표 유일성 검증을 대신하지 않는다.

## 데모·위치·테스트 비용 판정

- 두 BFF의 역할별 로그인/refresh 경로 제한, HttpOnly cookie, JWT exp 만료, 동일 프로세스 refresh 합치기, 원 요청 1회 재시도, 회전 뒤 실패 시 새 cookie 유지, 첫 fetch 실패의 JSON 502 흐름은 현재 문서와 맞는다.
- logout와 늦은 refresh 응답의 경합도 검토했다. 실제 common 구현에서 과거 refresh JWT도 같은 sessionId를 회수하므로 cookie가 늦게 다시 써져도 서버 refresh 세션이 살아나지 않는다. 남은 access JWT의 유효 기간은 문서의 stateless 계약이다. 새 보안 장치를 제안할 근거로 삼지 않았다.
- 콘솔의 publish 실패 후 동일 draft ID 수정·재시도는 기존 browser case가 확인한다. 로그인·극장/사용자 관리와 사용자 가입·홈 조회는 연결 데모로 적정하다. 예매/구매 전체 UI, 범용 인증/BFF framework, 대시보드 추가는 필수 누락이 아니다.
- `console-management.spec.ts` 이름은 실제 영화·극장·사용자 관리 범위를 반영한다. `request-validation.pipe` 파일도 HTTP 및 오류 변환이라고 명시하고 가장 가까운 소유자 옆에 있어 위치 이동이 필요한 오해는 없다. 순수 Seatmap·MovieRecommender와 workflow 오류 변환의 직접 테스트는 독립 계산/변환 책임 때문에 유지할 이유가 있다.
- 4복제본과 반복 CI, API/common 100% coverage는 의도한 검증 선택이다. 그 수치만으로 과잉이라고 판단하지 않았다. 브라우저가 API 테스트와 겹치는 행위를 해도 cookie·BFF·실제 화면 연결이라는 별도 경계를 확인하므로 유지한다.
- 응답/DB 결과를 나눠 반복하는 CRUD 사례는 더 있지만 대규모 일괄 병합을 권하지 않는다. 위의 동일 상영 정상 요청처럼 같은 준비·행동·조건을 반복하는 좁은 사례만 비용 개선 후보로 적었다.

## 검증 및 한계

- 직접 실행: 위 2개 비파괴 VM/async callback 격리 재현, 전체 파일 읽음 ledger 검증, 파일 hash/PNG metadata 검사, git status 확인. 저장소 tracked 변경 없음.
- 같은 기준 소스로 실행한 전체 단위·통합 테스트와 lint가 통과했다. 수치와 실행 범위는 [통합 결과](README.md)를 따른다.
- 기존 browser 3개 파일 전체에서 18개 테스트가 통과했다. first/retried upstream network 실패를 이 browser suite에서 주입했다고 주장하지 않는다.
- 이 감사에서 live race/benchmark/chaos/AtoZ는 실행하지 않았다. 공유 인프라를 중단하는 검증은 실행하지 않았다.
- PNG: 170550 bytes, 384×256, 8-bit RGBA, SHA256 `7799755dd19ae7381eac445de55e71311d17d266cca19bc92f59624c7d6da360`. 이미지 자체를 렌더링하지 않고 fixture 형식/메타데이터를 확인했다.
- small.file: 정확히 1024 bytes이며 마지막 UTF-8 문자가 잘려 있다. 현재는 raw bytes 업로드와 checksum 용도로만 사용하므로 결함으로 분류하지 않았다.
