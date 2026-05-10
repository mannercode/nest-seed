# 테스트

이 시드의 테스트는 mock을 거의 쓰지 않는다. 대신 Testcontainers로 실제 MongoDB Replica Set, Redis Cluster, MinIO를 띄우고 그 위에서 검증한다. 그래야 인덱스 동작, 트랜잭션, 레이스 컨디션처럼 mock으로 놓치기 쉬운 문제를 실제 환경에 가깝게 확인할 수 있다.

---

## 1. 테스트 구조와 한글 메시지 규칙

테스트 코드는 사람이 읽는 문서이기도 하다. 코드 식별자를 가리키는 곳은 영어를 그대로 쓴다. 시나리오를 설명하는 곳은 한글로 적는다. 이렇게 하면 테스트 흐름이 자연스럽게 읽힌다.

```
describe('ServiceName')         -- 서비스나 모듈 이름. 코드 식별자라 영어
  describe('POST /resource')    -- 엔드포인트. 영어
    describe('methodName')      -- 메서드 이름. 코드 식별자라 영어
      describe('조건이 충족되면')  -- 조건. 한글로 적는다
        beforeEach(...)         -- 조건을 만드는 셋업
        it('결과를 반환한다')      -- 결과 검증. 한글로 적는다
```

세부 약속은 다음과 같다.

- 최상위 `describe('ServiceName')`, HTTP 메서드/URL `describe('POST /resource')`, 메서드 이름 `describe('methodName')`처럼 코드 식별자를 가리키는 자리는 영어를 그대로 쓴다.
- 조건을 표현하는 `describe`는 한글 문자열을 직접 넣는다. `~할 때`, `~되었을 때`, `~않았을 때`처럼 절 형태로 적는다. 같은 내용을 한글 주석으로 다시 쓰지 않는다.
- 결과 검증을 표현하는 `it`도 한글 문자열을 직접 넣는다. `~한다`, `~반환한다`, `~던진다`처럼 결과가 드러나게 적는다. 부모 `describe`에 조건이 이미 있으므로 `it` 메시지에 조건을 반복하지 않는다.
- 조건을 만드는 일은 `beforeEach`에서 한다. `it` 안에서는 검증만 한다. 조건과 검증이 한 함수에 섞이면 시나리오가 잘 읽히지 않는다.

---

## 2. Fixture 패턴

각 테스트 스위트는 `createXxxFixture()` 팩토리로 자기만의 격리된 컨텍스트를 만든다. fixture는 그 스위트에 필요한 NestJS 모듈, HTTP 클라이언트, 시드 데이터 등을 묶어서 돌려준다. 테스트가 끝나면 `teardown()`으로 자원을 정리한다.

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
        it('생성된 고객을 반환한다', async () => {
            await fix.httpClient.post('/users').body(dto).created(expected)
        })

        describe('이메일이 이미 존재하면', () => {
            beforeEach(async () => {
                await fix.httpClient.post('/users').body(dto).created()
            })

            it('409 Conflict를 반환한다', async () => {
                await fix.httpClient.post('/users').body(dto).conflict()
            })
        })
    })
})
```

### 변경 테스트는 응답과 DB를 따로 검증한다

PATCH나 DELETE처럼 상태를 바꾸는 API는 두 가지를 확인해야 한다. 하나는 응답이 올바른지, 다른 하나는 DB에 실제로 반영되었는지다. 두 검증은 서로 다른 `it`으로 나눈다. 그래야 실패했을 때 어느 쪽 문제인지 바로 알 수 있다.

---

## 3. Dynamic Import — 왜 필요한가

테스트마다 격리된 환경을 만들기 위해 각 테스트는 자기만의 `TEST_ID`를 받는다. 그 ID로 MongoDB 데이터베이스와 S3 버킷을 따로 만든다. 그러려면 fixture가 테스트가 시작될 때마다 새로운 `TEST_ID`를 읽어야 한다.

문제는 일반적인 import 방식이다. 파일 맨 위에 `import { createUsersFixture } from './users.fixture'`라고 쓰면, 그 모듈은 처음 한 번만 평가된다. 그때 읽은 `process.env.TEST_ID`가 계속 남는다. 그러면 모든 테스트가 같은 DB를 바라보게 되어 격리가 깨진다.

이 문제를 피하려고 Jest 설정에 `resetModules: true`를 켠다. 그리고 fixture는 **`beforeEach` 안에서 `await import`로 동적으로 가져온다**. 이렇게 하면 테스트마다 모듈이 새로 평가되고, 그 시점의 `TEST_ID`가 fixture에 반영된다.

IDE 자동 완성과 타입 체크는 유지하고 싶다. 그래서 타입은 `import type`으로 정적으로 가져온다. 타입 import는 런타임 코드를 만들지 않는다.

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

테스트 인프라는 세 단계로 동작한다.

```
jest.global.js   Testcontainers로 MongoDB · Redis · MinIO를 1회 기동
jest.setup.js    beforeEach마다 TEST_ID를 발급하고 전용 DB·버킷을 만든다.
                  afterEach에서는 그 DB·버킷을 지운다.
*.spec.ts        개별 테스트가 fixture를 통해 위 자원에 붙는다.
```

`apps/api`의 통합 테스트는 devcontainer가 띄워 둔 공용 인프라(Mongo / Redis / MinIO 컨테이너)를 재사용한다. 반면 `libs/*`의 단위 테스트는 외부 의존을 줄이기 위해 testcontainers로 자체 인프라를 띄운다.

---

## 5. 분산 테스트 (cross-replica race)

한 프로세스 안에서 도는 테스트로는 여러 API 컨테이너가 동시에 같은 자원을 건드릴 때 생기는 레이스를 재현하기 어렵다. 이런 문제는 API 컨테이너 4개를 Docker Compose로 직접 띄우고, 바깥에서 HTTP 요청을 동시에 보내 봐야 잡힌다.

각 시나리오는 별도 Node 스크립트로 작성했다. 앱 코드는 import하지 않는다. 오직 HTTP 요청으로만 시스템과 상호작용한다. 인프라가 무겁고 시간도 오래 걸리므로 `package.json` 스크립트에 넣지 않고 셸에서 직접 실행한다.

| 파일                       | 검증 대상                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ |
| `sse.js`                   | SSE 이벤트가 모든 API 컨테이너의 클라이언트에게 빠짐없이 전달되는가            |
| `user-race.js`             | 같은 이메일 동시 가입 → unique index로 1개만 201, 나머지는 409                 |
| `ticket-holding-race.js`   | 같은 좌석 동시 hold → Redis SET NX로 1개만 204, 나머지는 409                   |
| `showtime-overlap-race.js` | 겹치는 시간대 saga 동시 요청 → 분산 락으로 1개 성공, 1개 실패                  |
| `purchase-double-spend.js` | 같은 티켓 묶음 동시 구매 → 1개만 201, 나머지는 409, 결제는 1건                 |
| `replica-chaos.js`         | API 컨테이너 4개 중 1개 kill → nginx 우회 처리로 5xx 1% 미만 유지              |
| `jwt-refresh-race.js`      | 같은 refresh token 동시 rotation → 새 토큰이 동시에 유효한 경우 0개 또는 1개만 |

각 스크립트는 요청마다 별도 `http.Agent({keepAlive:false})`를 만든다. nginx의 `least_conn`이 실제로 여러 컨테이너로 요청을 나누도록, keep-alive 풀을 공유하지 않기 위해서다. 응답의 `x-replica-id` 헤더로 요청이 여러 컨테이너에 분산되었는지도 함께 확인한다. 이렇게 해서 “사실은 한 컨테이너에만 갔는데 통과한” 가짜 성공을 막는다.

```bash
bash apps/api/tests/runner.sh <scenario>
```

CI는 [test-stability.yaml](../.github/workflows/test-stability.yaml)에서 같은 시나리오를 50회 반복 실행한다. 레이스 코드는 한 번 통과했다고 안전하다고 볼 수 없다. 그래서 결과가 얼마나 흔들리는지 누적으로 확인한다.
