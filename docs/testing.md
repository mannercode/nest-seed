# 테스트

이 시드의 테스트는 mock을 거의 쓰지 않는다. 대신 Testcontainers로 실제 MongoDB Replica Set, Redis Cluster, MinIO를 띄워 두고 그 위에서 검증한다. mock으로는 잡기 어려운 인덱스 동작, 트랜잭션, race condition 등을 실제 환경 그대로 확인할 수 있다.

---

## 1. 테스트 구조와 한글 주석 규칙

테스트 코드는 사람이 _읽기 위한_ 문서이기도 하다. 그래서 영어 메서드 이름과 한글 주석을 함께 써서, 코드만 보고도 시나리오가 자연스럽게 읽히도록 한다.

```
describe('ServiceName')                       -- 서비스나 모듈 이름. 한글 주석 없음
  describe('POST /resource')                  -- 엔드포인트나 메서드. 한글 주석 없음
    describe('when the condition is met')     -- 조건. 위에 한글 주석을 단다
      beforeEach(...)                         -- 조건을 실현하는 셋업
      it('returns the result')                -- 결과 검증. 위에 한글 주석을 단다
```

세부 약속은 다음과 같다.

- 조건을 표현하는 `describe` 는 항상 `when ~` 으로 시작한다. 그 위 한글 주석은 `~할 때`, `~되었을 때`, `~않았을 때` 처럼 절 형태로 적는다.
- `it` 의 메시지에는 조건을 다시 적지 않는다. 부모 `describe` 에 이미 조건이 적혀 있기 때문이다. 그 위 한글 주석은 `~한다`, `~반환한다`, `~던진다` 같은 결과 형태로 적는다.
- 조건의 셋업은 `beforeEach` 가 담당하고, `it` 안에서는 검증만 한다. 조건과 검증이 한 함수에 섞이면 시나리오가 잘 읽히지 않는다.

---

## 2. Fixture 패턴

각 테스트 스위트는 `createXxxFixture()` 팩토리로 자기만의 격리된 컨텍스트를 만든다. fixture는 그 스위트가 필요로 하는 NestJS 모듈, HTTP 클라이언트, 시드 데이터 등을 묶어서 돌려주고, 끝날 때 `teardown()` 으로 자원을 정리한다.

```ts
describe('UsersService', () => {
    let fix: UsersFixture

    beforeEach(async () => {
        fix = await createUsersFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('POST /users', () => {
        // 생성된 고객을 반환한다
        it('returns the created user', async () => {
            await fix.httpClient.post('/users').body(dto).created(expected)
        })

        // 이메일이 이미 존재할 때
        describe('when the email already exists', () => {
            beforeEach(async () => {
                await fix.httpClient.post('/users').body(dto).created()
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                await fix.httpClient.post('/users').body(dto).conflict()
            })
        })
    })
})
```

### 변경 테스트는 응답과 DB를 분리해서 검증

PATCH나 DELETE처럼 상태를 바꾸는 API는 _응답이 올바른가_ 와 _DB에 반영되었는가_ 를 다른 `it` 으로 분리한다. 두 검증이 한 함수에 섞이면 어느 쪽이 깨졌는지 한 눈에 알기 어렵다.

---

## 3. Dynamic Import — 왜 필요한가

테스트마다 격리된 환경을 만들기 위해, 각 테스트는 고유한 `TEST_ID` 를 부여받고 그 ID로 자기만의 MongoDB 데이터베이스와 S3 버킷을 만든다. 이게 동작하려면 fixture가 _매 테스트마다_ `TEST_ID` 를 다시 읽어 와야 한다.

문제는 보통 import 방식이다. 파일 맨 위에 `import { createUsersFixture } from './users.fixture'` 라고 써 두면 모듈은 첫 평가 시점에 한 번만 로드되고, 그 안에서 캡처한 `process.env.TEST_ID` 는 그 시점의 값으로 고정돼 버린다. 그러면 모든 테스트가 같은 DB를 가리키게 되고 격리가 깨진다.

이 문제를 피하기 위해 Jest 설정에 `resetModules: true` 를 켜고, fixture는 **`beforeEach` 안에서 `await import` 로 동적으로 가져온다**. 매번 모듈이 새로 평가되므로 그 시점의 `TEST_ID` 가 fixture에 정확히 반영된다. 다만 IDE의 자동 완성과 타입 체크는 살리고 싶으니, `import type` 으로 타입만 정적으로 import 한다 — 타입 import는 런타임 코드를 만들지 않는다.

```ts
import type { Fixture } from './users.fixture' // 타입만 — 런타임 영향 없음

describe('Users', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createUsersFixture } = await import('./users.fixture')
        fix = await createUsersFixture()
    })
})
```

---

## 4. 테스트 인프라

테스트 인프라는 세 단계로 나뉘어 동작한다.

```
jest.global.js   Testcontainers로 MongoDB · Redis · MinIO를 1회 기동
jest.setup.js    beforeEach마다 TEST_ID를 발급하고 전용 DB·버킷을 만든다.
                  afterEach에서는 그 DB·버킷을 지운다.
*.spec.ts        개별 테스트가 fixture를 통해 위 자원에 붙는다.
```

`apps/api` 의 통합 테스트는 devcontainer가 띄워 둔 공용 인프라(Mongo / Redis / MinIO 컨테이너)를 재사용한다. 반면 `libs/*` 의 단위 테스트는 외부 의존이 없도록 testcontainers로 자체 인프라를 매번 띄운다.

---

## 5. 분산 테스트 (cross-replica race)

단일 프로세스 테스트로는 _여러 replica가 동시에 같은 자원을 건드릴 때_ 발생하는 race를 재현하기 어렵다. 그런 race는 4-replica docker compose 스택을 직접 띄우고 블랙박스로 두드려 봐야 잡힌다.

각 시나리오는 별도 Node 스크립트로 작성되어 있고, 앱 코드를 import 하지 않고 오직 HTTP 요청으로만 시스템과 상호작용한다. 인프라가 무겁고 시간도 오래 걸려서 `package.json` 스크립트로 노출하지 않고 shell에서 직접 호출한다.

| 파일                       | 검증 대상                                                                        |
| -------------------------- | -------------------------------------------------------------------------------- |
| `sse.js`                   | SSE 이벤트가 모든 replica의 클라이언트에 빠짐없이 전달되는가                     |
| `user-race.js`             | 동일 이메일 동시 가입 → unique index로 1 × 201 + 나머지 × 409                    |
| `ticket-holding-race.js`   | 동시 hold-tickets → Redis SET NX로 1 × 204 + 나머지 × 409                        |
| `showtime-overlap-race.js` | 겹치는 시간대 saga 동시 요청 → 분산 락으로 1 succeeded + 1 failed                |
| `purchase-double-spend.js` | 동일 티켓 세트 동시 구매 → 분산 락 + 상태로 1 × 201 + 나머지 × 409 (payment 1건) |
| `replica-chaos.js`         | 4 replica 중 1개 kill → nginx proxy_next_upstream 으로 5xx 1% 미만 유지          |
| `jwt-refresh-race.js`      | 동일 refresh token 동시 rotation → 새 토큰 동시 유효 0 또는 1 (race-safe)        |

각 스크립트는 요청마다 별도 `http.Agent({keepAlive:false})` 를 만든다. nginx의 `least_conn` 이 실제로 여러 replica로 분산하도록 keep-alive 풀을 공유하지 않게 하려는 의도다. 응답에 실린 `x-replica-id` 헤더로 분산이 일어났는지를 함께 검증해서, "사실은 한 replica에만 갔다" 같은 가짜 통과를 막는다.

```bash
bash apps/api/tests/runner.sh <scenario>
```

CI는 [test-stability.yaml](../.github/workflows/test-stability.yaml) 에서 같은 시나리오를 50회 반복 실행하면서 flakiness를 누적 관측한다. race 코드는 한 번 통과했다고 안전하다고 보기 어렵기 때문에, 통계로 확인한다.
