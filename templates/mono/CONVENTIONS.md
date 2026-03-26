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
