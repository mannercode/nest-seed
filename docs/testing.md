# 테스트

이 시드의 테스트는 mock 객체를 거의 사용하지 않는다. 인덱스, 트랜잭션, 레이스 컨디션, 브라우저 연동처럼 mock으로는 놓치기 쉬운 문제를 실제 환경에 가깝게 확인하기 위해서다.

`apps/api` 통합 테스트는 devcontainer가 띄운 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal을 재사용한다. `libs/common` 테스트는 Testcontainers와 Temporal local test environment로 필요한 인프라를 직접 시작한다. 콘솔 e2e는 Playwright가 API와 Next.js dev 서버를 띄운 뒤 브라우저에서 흐름을 검증한다.

---

## 1. 테스트 구조와 한글 메시지 규칙

테스트 코드는 사람이 읽는 문서이기도 한다. 코드 식별자를 가리키는 곳은 영어를 그대로 쓰고, 시나리오와 기대 결과는 쉬운 한국어로 적는다. 이렇게 나누면 테스트 흐름이 자연스럽게 읽힌다.

```
describe('ServiceName')         -- 서비스나 모듈 이름. 코드 식별자이므로 영어
  describe('POST /resource')    -- 엔드포인트. 영어
    describe('methodName')      -- 메서드 이름. 코드 식별자이므로 영어
      describe('조건이 충족되면')  -- 조건. 한글로 작성
        beforeEach(...)         -- 조건을 만드는 셋업
        it('결과를 반환한다')      -- 결과 검증. 한글로 작성
```

세부 약속은 다음과 같다.

- 최상위 `describe('ServiceName')`, HTTP 메서드/URL `describe('POST /resource')`, 메서드 이름 `describe('methodName')`처럼 코드 식별자를 가리키는 자리는 영어를 그대로 쓴다.
- 조건을 표현하는 `describe`에는 한글 문자열을 직접 넣는다. `~할 때`, `~되었을 때`, `~않았을 때`처럼 절 형태로 적는다. 같은 내용을 주석으로 다시 쓰지 않는다.
- 결과 검증을 표현하는 `it`에도 한글 문자열을 직접 넣는다. `~한다`, `~반환한다`, `~던진다`처럼 결과가 드러나게 적는다. 부모 `describe`에 조건이 이미 있으면 `it` 메시지에서 조건을 반복하지 않는다.
- 조건은 `beforeEach`에서 만든다. `it` 안에서는 검증만 한다. 조건과 검증이 한 함수에 섞이면 시나리오가 잘 읽히지 않는다.

---

## 2. 픽스처 패턴

각 테스트 스위트는 `createXxxFixture()` 팩토리로 격리된 컨텍스트를 만든다. 픽스처는 필요한 NestJS 모듈, HTTP 클라이언트, 시드 데이터를 묶어서 반환한다. 테스트가 끝나면 `teardown()`으로 자원을 정리한다.

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

PATCH나 DELETE처럼 상태를 바꾸는 API는 두 가지를 확인한다. 하나는 응답이 올바른지, 다른 하나는 DB 반영 여부다. 두 검증은 서로 다른 `it`으로 나눈다. 그래야 실패했을 때 어느 쪽 문제인지 바로 알 수 있다.

---

## 3. 동적 가져오기 — 왜 필요한가

각 테스트가 다른 테스트와 부딪히지 않도록, 테스트마다 고유한 `TEST_ID`를 받는다. `apps/api` 테스트에서는 이 값으로 `PROJECT_ID`를 새로 만들고, 그 값이 Redis/cache prefix, NATS subject, Temporal task queue 이름에 반영된다. MongoDB 데이터베이스와 S3 버킷은 Jest worker별로 만들고, 각 테스트가 끝날 때 컬렉션과 버킷 내용을 비운다.

문제는 일반적인 가져오기 방식이다. 파일 맨 위에 `import { createUsersFixture } from './users.fixture'`라고 쓰면, 그 모듈은 처음 한 번만 평가된다. 그때 읽은 `process.env.PROJECT_ID`나 `process.env.TEST_ID`에서 cache prefix, NATS subject, Temporal queue 같은 값이 만들어지면 다음 테스트에서도 같은 값을 계속 쓰게 된다.

이 문제를 피하려고 Jest 설정에 `resetModules: true`를 켠다. 그리고 픽스처는 **`beforeEach` 안에서 `await import`로 동적으로 가져온다**. 이렇게 하면 테스트마다 모듈이 새로 평가되고, 그 시점의 `TEST_ID`와 `PROJECT_ID`가 픽스처와 앱 모듈에 반영된다.

IDE 자동 완성과 타입 체크는 유지하고 싶다. 그래서 타입은 `import type`으로 정적으로 가져온다. 타입 가져오기는 런타임 코드를 만들지 않는다.

```ts
import type { Fixture } from './users.fixture' // 타입만 가져오므로 런타임 영향 없음

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

Jest 기반 테스트 인프라는 세 단계로 동작한다.

```
jest.global.js   workspace별 전역 준비
                  - apps/api: workflow bundle 생성 (env는 Dev Container가 주입한 process.env를 그대로 사용)
                  - libs/common: Testcontainers로 MongoDB · Redis · MinIO · NATS 기동,
                    Temporal local test environment 생성
jest.setup.js    worker별 DB·버킷 준비
                  beforeEach마다 TEST_ID 발급
                  afterEach에서 컬렉션과 버킷 내용 정리
*.spec.ts        개별 테스트가 픽스처로 위 자원 사용
```

`apps/api`의 통합 테스트는 devcontainer가 시작해 둔 공용 인프라(Mongo / Redis / MinIO / NATS / Temporal 컨테이너)를 재사용한다. `libs/common`은 외부 의존을 줄이기 위해 Testcontainers로 자체 인프라를 시작한다. `libs/testing`과 `libs/temporal-sandbox`는 인프라 없는 단위 테스트로 돈다.

단일 spec만 실행하려면 Jest에 파일 패턴을 넘기고 커버리지 게이트를 끈다(`npm test`는 커버리지 100%를 요구해 부분 실행과 맞지 않다). VS Code에서는 devcontainer에 포함된 Jest Runner 확장으로 describe/it 단위 실행도 된다.

```bash
npm test -w apps/api -- users.spec --coverage=false
```

콘솔 e2e는 `tests/console-e2e`의 Playwright 설정이 `apps/api`와 `apps/console`을 빌드해 실행한 뒤 브라우저에서 로그인, 영화 등록 흐름을 검증한다. 개발 중 이미 서버가 떠 있으면 재사용한다.

---

## 5. 실행 가능한 API 문서

`apps/api/api-docs/*.spec`는 bash와 curl로 작성한 실행 가능한 API 문서이다. 문서를 따로 손으로 관리하지 않고, 실제 요청을 보내는 spec을 실행해 API 목록과 상세 요청/응답 로그를 만든다.

spec에는 사람이 읽을 설명을 `TEST`의 첫 번째 인자로 붙인다. 그룹은 spec 파일 이름에서 자동으로 만들어진다(`movies.spec` → `movies` 그룹).

```bash
TEST "영화를 생성한다" \
    201 POST /movies \
    -H 'Content-Type: application/json' \
    -d '{ ... }'
```

`SETUP <METHOD> <경로>`는 시나리오 준비 요청이다. 실패하면 문서 실행을 중단하지만, API 목록에는 넣지 않는다. 목록은 검증 대상인 `TEST`만 기록한다.

특정 spec만 실행하려면 파일 이름을 인자로 넘긴다: `bash apps/api/api-docs/run.sh movies.spec`

실행 결과는 `apps/api/api-docs/_output/` 아래에 남는다.

| 경로                     | 내용                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| `logs/<timestamp>/*.log` | spec별 실제 curl 명령, 응답 상태, 응답 본문                                  |
| `docs/summary.md`        | 최신 실행의 API 목록. 설명, method, endpoint, 기대/실제 상태, 상세 로그 링크 |
| `docs/summary.json`      | 같은 내용을 도구가 읽기 쉬운 JSON 배열로 저장                                |

```bash
bash deploy/verify.sh
# 또는 API가 이미 떠 있다면
cd apps/api/api-docs && bash run.sh
```

---

## 6. 분산 테스트 (복제본 간 레이스)

한 프로세스 안에서 실행하는 테스트만으로는 여러 API 컨테이너가 동시에 같은 자원에 접근할 때 생기는 레이스를 재현하기 어렵다. 이런 문제는 API 컨테이너 4개를 Docker Compose로 시작하고, 외부에서 HTTP 요청을 동시에 보내야 확인할 수 있다.

각 시나리오는 별도 Node 스크립트로 작성했다. 앱 코드는 가져오지 않고 HTTP 요청으로만 시스템과 상호작용한다. 인프라가 무겁고 시간도 오래 걸리므로 기본 `npm test`에는 넣지 않는다.

| 파일                       | 검증 대상                                                                  |
| -------------------------- | -------------------------------------------------------------------------- |
| `sse-fanout-race.js`       | SSE 이벤트가 모든 API 컨테이너의 클라이언트에게 빠짐없이 전달되는가        |
| `user-signup-race.js`      | 같은 이메일 동시 가입 → unique index로 1개만 201, 나머지는 409             |
| `ticket-holding-race.js`   | 같은 좌석 동시 선점 → Redis Lua script로 1개만 204, 나머지는 409           |
| `showtime-overlap-race.js` | 겹치는 시간대 사가 동시 요청 → 분산 락으로 1개 성공, 1개 실패              |
| `purchase-double-spend.js` | 같은 티켓 묶음 동시 구매 → 1개만 201, 나머지는 409, 결제는 1건             |
| `replica-chaos.js`         | API 컨테이너 4개 중 1개 종료 → NGINX 우회 처리로 5xx 1% 미만 유지          |
| `jwt-refresh-race.js`      | 같은 리프레시 토큰 동시 회전 → 새 토큰이 동시에 유효한 경우 0개 또는 1개만 |

각 스크립트는 요청마다 별도 `http.Agent({keepAlive:false})`를 만든다. NGINX의 `least_conn`이 실제로 여러 컨테이너로 요청을 나누도록 keep-alive 풀을 공유하지 않기 위해서다. 응답의 `x-replica-id` 헤더로 요청이 여러 컨테이너에 분산되었는지도 확인한다. 이렇게 해서 “사실은 한 컨테이너에만 갔는데 통과한” 거짓 성공을 막는다.

```bash
bash tests/api-race/runner.sh <scenario>
```

CI는 [test-stability.yaml](../.github/workflows/test-stability.yaml)의 `scenario` job에서 각 분산 시나리오를 50회 반복 실행한다. 같은 워크플로 안에서 단위/통합 테스트는 75회, 부팅 검증은 50회 반복한다. 레이스 코드는 한 번 통과했다고 안전하다고 보기 어렵다. 그래서 결과가 얼마나 흔들리는지 누적으로 확인한다.
