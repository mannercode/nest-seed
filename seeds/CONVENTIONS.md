# 프로젝트 컨벤션

## 네이밍 규칙

### 디렉토리: common vs shared

이 프로젝트에서 `common`과 `shared`는 서로 다른 범위를 가진다.

| 위치                           | 범위              | import 경로           | 내용                                    |
| ------------------------------ | ----------------- | --------------------- | --------------------------------------- |
| `packages/common/`             | 프로젝트 간 공유  | `@mannercode/common`  | Mongoose, Redis, JWT, S3, Logger, utils |
| `seeds/*/src/config/`          | 앱 전체           | `'config'` (tsconfig) | AppConfig, Rules, Pipes, configureApp   |
| `seeds/*/src/**/cores/shared/` | cores 레이어 내부 | 상대 경로             | 도메인 모델 (예: Seat)                  |

- `packages/common/` — 프로젝트 간 공유 인프라 유틸리티
- `src/config/` — 앱 전체 설정, 모듈, 파이프
- `cores/shared/` — 단일 아키텍처 레이어 내에서 공유되는 도메인 모델
- `cores/` 외부에 `shared` 디렉토리를 만들지 않는다. 더 넓은 범위의 공유가 필요하면 `config`나 패키지로 이동한다.

### 파일 네이밍

| 유형                    | 패턴                          | 예시                                    |
| ----------------------- | ----------------------------- | --------------------------------------- |
| DTO                     | `[action-entity].dto.ts`      | `create-customer.dto.ts`                |
| 페이지네이션 검색 DTO   | `search-[entity].page.dto.ts` | `search-customers.page.dto.ts`          |
| 비페이지네이션 검색 DTO | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| 결과 (동기 벌크 연산)   | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| 응답 (비동기 요청 응답) | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| 모델                    | `[entity].ts`                 | `customer.ts`                           |
| 에러                    | `errors.ts`                   | `errors.ts`                             |
| 클라이언트 (MSA)        | `[service].client.ts`         | `customers.client.ts`                   |

### 클래스 & DTO 네이밍

- **DTO**: `[Action][Entity]Dto` — `CreateCustomerDto`, `SearchMoviesPageDto`
- **엔티티 DTO**: `[Entity]Dto` — `CustomerDto`, `TicketDto`
- **결과**: `[Action][Entity]Result` — `CreateShowtimesResult`
- **응답**: `[Action]Response` — `RequestShowtimeCreationResponse`
- **에러 상수**: `[Entity]Errors` — `CustomerErrors`, `BookingErrors`

### 메서드 네이밍

| 메서드             | 용도                         | 반환                          |
| ------------------ | ---------------------------- | ----------------------------- |
| `create`           | 단일 생성                    | `EntityDto`                   |
| `createMany`       | 벌크 생성                    | `Create[Entity]Result`        |
| `getMany`          | ID로 조회 (모두 존재해야 함) | `EntityDto[]`                 |
| `search`           | 비페이지네이션 필터 조회     | `EntityDto[]`                 |
| `searchPage`       | 페이지네이션 조회            | `PaginationResult<EntityDto>` |
| `search[Field]`    | 특정 필드만 반환             | `string[]`, `Date[]`          |
| `update`           | 단일 수정                    | `EntityDto`                   |
| `updateStatusMany` | 벌크 상태 변경               | `EntityDto[]`                 |
| `deleteMany`       | ID로 삭제                    | `void`                        |
| `allExist`         | 모든 ID 존재 확인            | `boolean`                     |
| `anyExist`         | 하나라도 존재 확인           | `boolean`                     |
| `exists`           | 단일 ID 존재 확인            | `boolean`                     |

**Repository 전용** (Client로 노출하지 않음):

- `findById` / `findByIds` — nullable 반환, 호출자가 처리
- `getById` / `getByIds` — 없으면 `NotFoundException` throw

### Predicate 함수

| 접두어       | 용도                | 예시               |
| ------------ | ------------------- | ------------------ |
| **`is`**     | 상태 확인           | `isPublished()`    |
| **`has`**    | 소유 여부           | `hasMoviePoster()` |
| **`can`**    | 권한/가능 여부      | `canActivate()`    |
| **`should`** | 규칙 기반 권장 여부 | `shouldArchive()`  |

긍정형으로 네이밍한다. (`isActive` O, `isNotActive` X)

### 검증 함수

| 동사         | 용도                                     |
| ------------ | ---------------------------------------- |
| **`verify`** | 확인하고, 실패 시 예외 throw             |
| **`check`**  | 결과를 boolean으로 반환 (검사 행위 강조) |
| **`ensure`** | 없으면 생성                              |

### 날짜/시간 필드

| 접미어        | 의미                                 | 예시                       |
| ------------- | ------------------------------------ | -------------------------- |
| **`xxxDate`** | 달력상의 날짜 (YYYY-MM-DD)           | `releaseDate`, `birthDate` |
| **`xxxAt`**   | 특정 시점 (timestamp, 시/분/초 포함) | `createdAt`, `expiresAt`   |

### 생성자 파라미터

- **Client/Service**: 타입의 camelCase 그대로 — `ticketsClient: TicketsClient`, `paymentsClient: PaymentsClient`
- **Repository**: 서비스당 하나일 때 `repository` — `repository: CustomersRepository`
- **Controller**: 항상 `service` — `service: CustomersService`
- **Client proxy**: 항상 `proxy` — `proxy: ClientProxyService`

### 에러 객체

각 항목은 에러 객체를 반환하는 팩토리 함수다. 컨텍스트별 필드는 파라미터로 전달하고 `code`, `message`와 함께 반환한다.

```typescript
export const [Entity]Errors = {
    // 추가 컨텍스트 없음
    ErrorKey: () => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.'
    }),
    // 컨텍스트 파라미터 포함
    ErrorKeyWithContext: (param: type) => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.',
        param
    })
}
```

- 에러 상수(`[Entity]Errors`)는 서비스 디렉토리의 별도 `errors.ts` 파일에 정의한다.
- 서비스 클래스 파일 내에 인라인으로 정의하지 않는다.
- 서비스 디렉토리의 `index.ts`에서 재수출한다: `export * from './errors'`

### 이벤트 키

- 이벤트 키는 camelCase를 사용한다: `Events.Purchase.ticketPurchased`, `Events.Purchase.ticketPurchaseCanceled`

### Client ↔ Service 대칭

Client 메서드는 Service 메서드와 동일하게 구성한다 (같은 이름, 같은 파라미터 순서). Client는 `proxy.request()`를 래핑한다.

### Client 반환 패턴

- **값 반환**: `return this.proxy.request(...)` — `async`/`await` 없이
- **Void**: `async method() { await this.proxy.request(...) }` — `async`/`await` 필수

---

## Type vs Interface

기본적으로 `type`을 사용한다. `interface`는 클래스가 구현(implements)하거나 외부 확장(declaration merging)이 필요한 경우에 사용한다.

| 상황                                  | 선택        |
| ------------------------------------- | ----------- |
| 앱 내부 고정 데이터 구조              | `type`      |
| 타입 연산 (유니온/매핑/조건부)        | `type`      |
| 클래스가 구현해야 하는 계약           | `interface` |
| 패키지 퍼블릭 타입 (소비자 확장 허용) | `interface` |

---

## 주석 스타일

```ts
// 한 줄은 이렇게 한다.

/**
 * 두 줄 이상은 이렇게 한다.
 */
```

`/* ... */` 형태(별표 없는 블록 주석)는 사용하지 않는다. 편집기에서 자동 정렬이 되지 않는다.

---

## 테스트 컨벤션

### 구조

```
describe('ServiceName')                       -- 최상위: 서비스/모듈명 (한글 주석 없음)
  describe('POST /resource')                  -- 엔드포인트 또는 메서드명 (한글 주석 없음)
    describe('when the condition is met')     -- 조건 (위에 한글 주석)
      beforeEach(...)                         -- 조건 실현
      it('returns the result')               -- 결과 검증 (위에 한글 주석)
```

### 규칙

1. **describe (서비스/엔드포인트/메서드)** — 한글 주석 없음
2. **describe (조건)** — 항상 `when ~`으로 시작. 위에 한글 주석: `// ~할 때` / `~되었을 때`
3. **it (결과)** — 조건(`when`)을 포함하지 않음. 위에 한글 주석: `// ~한다` / `~반환한다` / `~던진다`
4. **beforeEach** — 부모 describe의 `when ~` 조건을 구현. `it`에서는 검증만
5. **step** — E2E 시나리오에서 여러 단계가 순차적으로 의존할 때 사용. 영어만, 한글 주석 없음

### 한글 주석 스타일

- 조건: `~할 때`, `~되었을 때`, `~않았을 때` (`~된 때`, `~않은 때` 사용하지 않음)
- 결과: `~한다`, `~반환한다`, `~던진다`
- 한글 주석은 `describe`나 `it` 바로 위 줄에 배치

### 데이터 기반 테스트

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

### 변경 테스트 분리

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

### Fixture 패턴

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

### HttpTestClient Fluent API

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
