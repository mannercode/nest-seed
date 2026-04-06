# 테스트

## 1. 테스트 구조

```
describe('ServiceName')                       -- 최상위: 서비스/모듈명 (한글 주석 없음)
  describe('POST /resource')                  -- 엔드포인트 또는 메서드명 (한글 주석 없음)
    describe('when the condition is met')     -- 조건 (위에 한글 주석)
      beforeEach(...)                         -- 조건 실현
      it('returns the result')               -- 결과 검증 (위에 한글 주석)
```

### 규칙

1. **describe (서비스/엔드포인트/메서드)** — 한글 주석 없음
2. **describe (조건)** — 항상 `when ~`으로 시작. 위에 한글 주석: `~할 때` / `~되었을 때`
3. **it (결과)** — 조건(`when`)을 포함하지 않음. 위에 한글 주석: `~한다` / `~반환한다` / `~던진다`
4. **beforeEach** — 부모 describe의 `when ~` 조건을 구현. `it`에서는 검증만
5. **step** — E2E 시나리오에서 여러 단계가 순차적으로 의존할 때 사용. 영어만, 한글 주석 없음

### 한글 주석 스타일

- 조건: `~할 때`, `~되었을 때`, `~않았을 때` (`~된 때`, `~않은 때` 사용하지 않음)
- 결과: `~한다`, `~반환한다`, `~던진다`
- 한글 주석은 `describe`나 `it` 바로 위 줄에 배치

---

## 2. Fixture 패턴

각 테스트 스위트는 `createXxxFixture()` 팩토리로 격리된 컨텍스트를 생성한다.

```typescript
describe('CustomersService', () => {
    let fix: CustomersFixture

    beforeEach(async () => {
        fix = await createCustomersFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('POST /customers', () => {
        // 생성된 고객을 반환한다
        it('returns the created customer', async () => {
            await fix.httpClient.post('/customers').body(dto).created(expected)
        })

        // 이메일이 이미 존재할 때
        describe('when the email already exists', () => {
            beforeEach(async () => {
                await fix.httpClient.post('/customers').body(dto).created()
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                await fix.httpClient.post('/customers').body(dto).conflict()
            })
        })
    })
})
```

---

## 3. 데이터 기반 테스트

단순 입력/출력 검증에는 `it.each`를 사용하여 각 케이스를 독립적으로 리포팅한다.

```typescript
// (Bad) 하나가 실패하면 나머지 결과를 알 수 없음
it('converts units to bytes', () => {
    expect(Byte.fromString('1kb')).toEqual(1024)
    expect(Byte.fromString('1mb')).toEqual(1024 * 1024)
})

// (Good) 모든 케이스가 독립적으로 실행 및 리포팅됨
it.each([
    ['1024b', 1024],
    ['1kb', 1024],
    ['1mb', 1024 * 1024]
])('converts %s to %i', (input, expected) => {
    expect(Byte.fromString(input)).toEqual(expected)
})
```

---

## 4. 변경 테스트 분리

PATCH, DELETE 등 상태를 변경하는 API 테스트 시, **응답 검증**과 **영속성(DB) 검증**은 서로 다른 `it`으로 분리한다.

```typescript
describe('DELETE /customers/:id', () => {
    beforeEach(async () => {
        /* delete 실행 */
    })

    // 200 OK를 반환한다
    it('returns 200 OK', async () => {
        /* 응답 검증 */
    })

    // DB에서 고객이 삭제된다
    it('removes the customer from the database', async () => {
        /* DB 검증 */
    })
})
```

---

## 5. HttpTestClient Fluent API

`@mannercode/testing` 패키지가 superagent 기반의 `HttpTestClient`를 제공한다.

```typescript
// POST + body, 201 기대
await client.post('/movies').body(createDto).created(expectedDto)

// GET + query params, 200 기대
await client.get('/movies').query({ title: 'Inception' }).ok(expectedList)

// 특정 에러 상태 기대
await client.post('/customers').body(duplicateDto).conflict()

// 파일 업로드
await client
    .post('/assets')
    .attachments([{ name: 'file', file: buffer }])
    .created()
```

**사용 가능한 assertion**: `.ok()`, `.created()`, `.accepted()`, `.noContent()`, `.badRequest()`, `.unauthorized()`, `.notFound()`, `.conflict()`, `.payloadTooLarge()`, `.unprocessableEntity()`, `.unsupportedMediaType()`, `.internalServerError()`

---

## 6. Dynamic Import

각 테스트마다 고유한 DB 이름과 NATS subject를 생성하기 위해 `process.env.TEST_ID`를 사용한다.

Jest 설정에서 `resetModules: true`를 적용하고, 테스트에서는 dynamic import를 사용하여 각 테스트가 독립된 환경에서 실행되도록 한다. MSA에서는 `@MessagePattern` 데코레이터가 모듈 로딩 시점에 한 번만 평가되므로 이 방식이 필수적이다.

```ts
// 타입 전용 import는 런타임에 영향을 주지 않는다
import type { Fixture } from './customers.fixture'

describe('Customers', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createCustomersFixture } = await import('./customers.fixture')
        fix = await createCustomersFixture()
    })
})
```

---

## 7. 테스트 인프라

Mock 없음 — 실제 MongoDB RS, Redis Cluster, NATS, MinIO, Temporal을 사용한다.

### 실행 흐름

```
jest.global.js          Testcontainers로 인프라 기동 (1회)
  ↓                     NATS, MongoDB, Redis, MinIO, Temporal
jest.setup.js           각 테스트 스위트마다 실행
  ↓                     TEST_ID 생성, 전용 DB/S3 버킷 생성, 종료 시 DB 삭제
*.spec.ts               개별 테스트 실행
```

### 환경 변수

`jest.global.js`에서 Testcontainers를 시작하고 환경 변수를 설정한다.

| 환경 변수                  | 설정 주체           | 용도                  |
| -------------------------- | ------------------- | --------------------- |
| `TESTLIB_NATS_OPTIONS`     | `jest.global`       | NATS 연결 옵션 (JSON) |
| `TESTLIB_MONGO_URI`        | `jest.global`       | MongoDB 연결 문자열   |
| `TESTLIB_MONGO_DATABASE`   | `jest.setup`        | 테스트별 DB 이름      |
| `TESTLIB_REDIS_URL`        | `jest.global`       | Redis 연결 URL        |
| `TESTLIB_S3_*`             | `jest.global/setup` | MinIO/S3 설정         |
| `TESTLIB_TEMPORAL_ADDRESS` | `jest.global`       | Temporal 서버 주소    |
| `TEST_ID`                  | `jest.setup`        | 테스트 격리용 고유 ID |

### 테스트 격리

`jest.setup.js`에서 `beforeEach`마다 10자리 랜덤 `TEST_ID`를 생성한다. 이를 기반으로:

- MongoDB: `mongo-{TEST_ID}` 데이터베이스 생성, `afterEach`에서 삭제
- S3: `s3bucket{TEST_ID}` 버킷 생성
- NATS: `withTestId(subject)`로 고유 subject 생성

---

## 8. 커버리지 설정

`jest.config.ts`에서 100% 커버리지를 강제한다.

```typescript
coverageThreshold: {
    global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
    }
}
```

**커버리지 제외 대상**: `__tests__`, `main.ts`, `*.module.ts`, `index.ts`, `configure-app.ts`, `production.ts`, `development.ts`, `/workflows/`

### Jest 설정

| 설정                         | 값                                   | 이유                                             |
| ---------------------------- | ------------------------------------ | ------------------------------------------------ |
| `resetModules`               | `true`                               | 테스트마다 모듈 캐시 초기화, `TEST_ID` 격리 보장 |
| `resetMocks`                 | `true`                               | mock 상태 자동 초기화                            |
| `testRegex`                  | `__tests__/.*\.spec\.ts`             | `__tests__` 폴더 내 spec 파일만 실행             |
| `testTimeout`                | 60초                                 | Testcontainers 기동 시간 고려                    |
| `coverageThreshold`          | 100% (전체)                          | branches, functions, lines, statements 모두 100% |
| `coveragePathIgnorePatterns` | `__tests__`, `index.ts`, `/testing/` | 테스트 코드, barrel, testing 패키지 제외         |
