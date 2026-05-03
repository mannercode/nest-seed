# 테스트

Mock 없음 — 실제 MongoDB RS, Redis Cluster, MinIO를 Testcontainers로 띄워 사용한다.

## 1. 구조와 한글 주석 규칙

```
describe('ServiceName')                       -- 서비스/모듈 (한글 주석 없음)
  describe('POST /resource')                  -- 엔드포인트/메서드 (한글 주석 없음)
    describe('when the condition is met')     -- 조건 (위에 한글 주석)
      beforeEach(...)                         -- 조건 실현
      it('returns the result')                -- 결과 검증 (위에 한글 주석)
```

- 조건 describe는 항상 `when ~`. 위 한글 주석: `~할 때`, `~되었을 때`, `~않았을 때`
- it은 조건을 포함하지 않는다. 위 한글 주석: `~한다`, `~반환한다`, `~던진다`
- beforeEach는 부모 `when ~` 조건을 구현. it에서는 검증만.

---

## 2. Fixture 패턴

각 테스트 스위트는 `createXxxFixture()` 팩토리로 격리된 컨텍스트를 만든다.

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

### 변경 테스트 분리

PATCH/DELETE는 **응답 검증**과 **DB 검증**을 다른 `it`으로 분리.

---

## 3. Dynamic Import (왜 필요한가)

각 테스트마다 고유한 DB 이름(`TEST_ID`)을 만든다. Jest의 `resetModules: true`로 모듈 캐시를 초기화하므로, fixture는 **`beforeEach` 안에서 `await import`** 해야 한다. top-level static import는 reset 이전에 한 번만 평가돼 격리가 깨진다.

```ts
import type { Fixture } from './users.fixture'   // 타입만 — 런타임 영향 X

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

```
jest.global.js   Testcontainers로 MongoDB / Redis / MinIO 기동 (1회)
jest.setup.js    beforeEach마다 TEST_ID 생성 → DB·버킷 생성, afterEach 삭제
*.spec.ts        개별 테스트
```

`apps/api`의 통합 테스트는 devcontainer 공용 인프라를 재사용한다. `libs/*`는 testcontainers 자체 인프라.

---

## 5. 분산 테스트 (cross-replica race)

단일 프로세스로는 검증할 수 없는 race를 4-replica docker compose 스택에서 블랙박스로 검증한다. 각 시나리오는 별도 Node 스크립트(앱 코드 import 없음, HTTP만)이며 `package.json`에는 노출하지 않는다.

| 파일                       | 검증 대상                                                                     |
| -------------------------- | ----------------------------------------------------------------------------- |
| `sse.js`                   | SSE 이벤트가 모든 replica의 클라이언트에 전달                                 |
| `user-race.js`             | 동일 이메일 동시 POST → unique index로 정확히 1 × 201 + N-1 × 409             |
| `ticket-holding-race.js`   | 동시 hold-tickets → Redis SET NX로 정확히 1 × 200 + N-1 × 409                 |
| `showtime-overlap-race.js` | 겹치는 시간대 saga 동시 요청 → 분산 락으로 1 succeeded + 1 failed            |
| `purchase-double-spend.js` | 동일 티켓 세트 동시 구매 → 분산 락 + 상태로 1 × 201 + N-1 × 409 (payment 1개) |

각 시나리오는 요청마다 별도 `http.Agent({keepAlive:false})`를 써서 nginx `least_conn`이 실제로 replica를 분산하도록 유도하고, 응답의 `x-replica-id`로 분산 여부를 검증한다.

```bash
bash apps/api/tests/runner.sh <scenario>
```

CI는 [test-stability.yaml](../.github/workflows/test-stability.yaml)에서 50회 반복으로 flakiness를 누적 관측한다.
