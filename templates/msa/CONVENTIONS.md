# Project Conventions

## Naming Conventions

### File Naming

| Category                       | Pattern                       | Example                                 |
| ------------------------------ | ----------------------------- | --------------------------------------- |
| DTO                            | `[action-entity].dto.ts`      | `create-customer.dto.ts`                |
| Paginated search DTO           | `search-[entity].page.dto.ts` | `search-customers.page.dto.ts`          |
| Non-paginated search DTO       | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| Result (sync bulk operation)   | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| Response (async request reply) | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| Model                          | `[entity].ts`                 | `customer.ts`                           |
| Error                          | `errors.ts`                   | `errors.ts`                             |

### Class & DTO Naming

- **DTO**: `[Action][Entity]Dto` — `CreateCustomerDto`, `SearchMoviesPageDto`
- **Entity DTO**: `[Entity]Dto` — `CustomerDto`, `TicketDto`
- **Result**: `[Action][Entity]Result` — `CreateShowtimesResult`
- **Response**: `[Action]Response` — `RequestShowtimeCreationResponse`
- **Error constant**: `[Entity]Errors` — `CustomerErrors`, `BookingErrors`

### Method Naming

| Verb               | Usage                         | Return                        |
| ------------------ | ----------------------------- | ----------------------------- |
| `create`           | Create single item            | `EntityDto`                   |
| `createMany`       | Bulk create                   | `Create[Entity]Result`        |
| `getMany`          | Fetch by IDs (all must exist) | `EntityDto[]`                 |
| `search`           | Non-paginated filtered query  | `EntityDto[]`                 |
| `searchPage`       | Paginated query               | `PaginationResult<EntityDto>` |
| `search[Field]`    | Return specific fields        | `string[]`, `Date[]`          |
| `update`           | Update single item            | `EntityDto`                   |
| `updateStatusMany` | Batch status update           | `EntityDto[]`                 |
| `deleteMany`       | Delete by IDs                 | `void`                        |
| `allExist`         | Check all IDs exist           | `boolean`                     |
| `anyExist`         | Check any ID exists           | `boolean`                     |
| `exists`           | Check single ID exists        | `boolean`                     |

**Repository-level only** (not exposed via Client):

- `findById` / `findByIds` — nullable return, caller handles missing
- `getById` / `getByIds` — throws `NotFoundException` if missing

### Predicate Functions

| Prefix       | Usage               | Example            |
| ------------ | ------------------- | ------------------ |
| **`is`**     | 상태 확인           | `isPublished()`    |
| **`has`**    | 소유 여부           | `hasMoviePoster()` |
| **`can`**    | 권한/가능 여부      | `canActivate()`    |
| **`should`** | 규칙 기반 권장 여부 | `shouldArchive()`  |

긍정형으로 네이밍한다. (`isActive` O, `isNotActive` X)

### Validation Functions

| Verb         | Usage                                    |
| ------------ | ---------------------------------------- |
| **`verify`** | 확인하고, 실패 시 예외 throw             |
| **`check`**  | 결과를 boolean으로 반환 (검사 행위 강조) |
| **`ensure`** | 없으면 생성                              |

### Date/Time Field Naming

| Suffix        | 의미                                 | Example                    |
| ------------- | ------------------------------------ | -------------------------- |
| **`xxxDate`** | 달력상의 날짜 (YYYY-MM-DD)           | `releaseDate`, `birthDate` |
| **`xxxAt`**   | 특정 시점 (timestamp, 시·분·초 포함) | `createdAt`, `expiresAt`   |

### Constructor Parameter Naming

- **Client/Service**: exact camelCase of the type — `ticketsClient: TicketsClient`, `paymentsClient: PaymentsClient`
- **Repository**: `repository` when one per service — `repository: CustomersRepository`
- **Controller**: always `service` — `service: CustomersService`
- **Client proxy**: always `proxy` — `proxy: ClientProxyService`

### Error Object

Each entry is a factory function that returns an error object. Context-specific fields are passed as parameters and included in the returned object alongside `code` and `message`.

```typescript
export const [Entity]Errors = {
    // No additional context
    ErrorKey: () => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.'
    }),
    // With context parameters
    ErrorKeyWithContext: (param: type) => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.',
        param
    })
}
```

### Event Key Naming

- Event keys use camelCase: `Events.Purchase.ticketPurchased`, `Events.Purchase.ticketPurchaseCanceled`

### Client ↔ Service Parity

Client methods mirror service methods exactly (same name, same parameter order). Client wraps `proxy.request()`.

### Client Return Pattern

- **Value-returning**: `return this.proxy.request(...)` — no `async`/`await`
- **Void**: `async method() { await this.proxy.request(...) }` — `async`/`await` required

### Error File Location

- Error constants (`[Entity]Errors`) are always defined in a separate `errors.ts` file at the service directory level.
- Never define error constants inline within the service class file.
- Re-export via the service directory's `index.ts`: `export * from './errors'`

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

## Comment Style

```ts
// 한 줄은 이렇게 한다.

/**
 * 두 줄 이상은 이렇게 한다.
 */
```

`/* ... */` 형태(별표 없는 블록 주석)는 사용하지 않는다. 편집기에서 자동 정렬이 되지 않는다.

---

## Test Conventions (describe / it / beforeEach)

### Structure

```
describe('ServiceName')                       -- top-level: service/module name (no Korean comment)
  describe('POST /resource')                  -- endpoint or method name (no Korean comment)
    describe('when the condition is met')     -- condition (Korean comment above)
      beforeEach(...)                         -- realize the condition
      it('returns the result')               -- verify the result (Korean comment above)
```

### Rules

1. **describe (service/endpoint/method)** - No Korean comment
2. **describe (condition)** - Always starts with `when ~`. Korean comment above: `// ~할 때` / `~되었을 때`
3. **it (result)** - Never includes conditions (`when`). Korean comment above: `// ~한다` / `~반환한다` / `~던진다`
4. **beforeEach** - Implements the `when ~` condition from its parent describe. `it` only verifies.
5. **step** - Used for E2E scenarios where multiple steps depend on each other sequentially. English only, no Korean comments.

### Korean Comment Style

- Conditions: `~할 때`, `~되었을 때`, `~않았을 때` (NOT `~된 때`, `~않은 때`)
- Results: `~한다`, `~반환한다`, `~던진다`
- Korean comment is placed on the line directly above the `describe` or `it`

### Data-Driven Tests

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

### Mutation Test Separation

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

### Example

```typescript
describe('CustomersService', () => {
  describe('POST /customers', () => {
    // 생성된 고객을 반환한다
    it('returns the created customer', async () => { ... })

    // 이메일이 이미 존재할 때
    describe('when the email already exists', () => {
      beforeEach(async () => { ... })

      // 409 Conflict를 반환한다
      it('returns 409 Conflict', async () => { ... })
    })
  })
})
```
