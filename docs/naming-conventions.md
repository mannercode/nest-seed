# Naming Conventions

## Directory Naming: "common" vs "shared"

This project uses both `common` and `shared` as directory names. Each serves a distinct purpose.

### common

Used for **broadly reusable** code — either as a published package or as app-wide configuration.

| Location                  | Scope         | Import Path           | Contains                                |
| ------------------------- | ------------- | --------------------- | --------------------------------------- |
| `packages/common/`        | Cross-project | `@mannercode/common`  | Mongoose, Redis, JWT, S3, Logger, utils |
| `templates/*/src/config/` | App-wide      | `'config'` (tsconfig) | AppConfig, Rules, Pipes, configureApp   |

The tsconfig alias `'config'` and the npm package `@mannercode/common` resolve to different paths, and the names are clearly distinct.

### shared

Used for **domain models shared within a bounded context**.

| Location                           | Scope       | Import Path     | Contains                   |
| ---------------------------------- | ----------- | --------------- | -------------------------- |
| `templates/*/src/**/cores/shared/` | cores layer | Relative import | Domain models (e.g., Seat) |

The `shared` directory only exists inside `cores/` and contains models used by multiple core services. Its scope is intentionally narrow.

### Guidelines

- `packages/common/` (`@mannercode/common`) — cross-project infrastructure utilities
- `src/config/` — app-wide configuration, modules, pipes
- `cores/shared/` — domain models shared within a single architectural layer
- Don't create new `shared` directories outside of `cores/` — if something needs wider sharing, it belongs in `config` or in a package

## File Naming

| Type                       | Pattern                       | Example                                 |
| -------------------------- | ----------------------------- | --------------------------------------- |
| DTO                        | `[action-entity].dto.ts`      | `create-customer.dto.ts`                |
| Search DTO (paginated)     | `search-[entity].page.dto.ts` | `search-customers.page.dto.ts`          |
| Search DTO (non-paginated) | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| Result (sync bulk op)      | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| Response (async reply)     | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| Model                      | `[entity].ts`                 | `customer.ts`                           |
| Errors                     | `errors.ts`                   | `errors.ts`                             |
| Client (MSA)               | `[service].client.ts`         | `customers.client.ts`                   |

## Class Naming

| Type       | Pattern                   | Example                           |
| ---------- | ------------------------- | --------------------------------- |
| DTO        | `Create[Entity]Dto`       | `CreateCustomerDto`               |
| Search DTO | `Search[Entity]PageDto`   | `SearchMoviesPageDto`             |
| Entity DTO | `[Entity]Dto`             | `CustomerDto`                     |
| Result     | `Create[Entity]Result`    | `CreateShowtimesResult`           |
| Response   | `Request[Action]Response` | `RequestShowtimeCreationResponse` |
| Errors     | `[Entity]Errors`          | `CustomerErrors`, `BookingErrors` |

## Method Naming

| Method             | Usage                | Return Type                   |
| ------------------ | -------------------- | ----------------------------- |
| `create`           | Create single        | `EntityDto`                   |
| `createMany`       | Bulk create          | `Create[Entity]Result`        |
| `getMany`          | Fetch by IDs         | `EntityDto[]`                 |
| `search`           | Non-paginated filter | `EntityDto[]`                 |
| `searchPage`       | Paginated query      | `PaginationResult<EntityDto>` |
| `update`           | Update single        | `EntityDto`                   |
| `updateStatusMany` | Batch status update  | `EntityDto[]`                 |
| `deleteMany`       | Delete by IDs        | `void`                        |
| `allExist`         | All IDs exist?       | `boolean`                     |
| `anyExist`         | Any ID exists?       | `boolean`                     |
| `exists`           | Single ID exists?    | `boolean`                     |

## Constructor Parameter Naming

| Context        | Pattern                          | Example                           |
| -------------- | -------------------------------- | --------------------------------- |
| Client/Service | `[name]Client` / `[name]Service` | `ticketsClient`, `cacheService`   |
| Repository     | `repository`                     | `repository: CustomersRepository` |
| Controller     | `service`                        | `service: CustomersService`       |

## Error Pattern

```typescript
export const CustomerErrors = {
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_CUSTOMERS_EMAIL_ALREADY_EXISTS',
        message: `Customer with email "${email}" already exists.`,
        email
    }),
    NotFound: (customerId: string) => ({
        code: 'ERR_CUSTOMERS_NOT_FOUND',
        message: `Customer not found: ${customerId}`,
        customerId
    })
}
```

- Defined in a separate `errors.ts` per service
- Factory functions return structured error objects with `code`, `message`, and context fields
- Re-exported via service barrel (`index.ts`)

## Time Field Naming

| Suffix    | Format        | Example     |
| --------- | ------------- | ----------- |
| `xxxDate` | `YYYY-MM-DD`  | `birthDate` |
| `xxxAt`   | ISO timestamp | `createdAt` |

## Predicate and Validation Naming

| Prefix    | Usage                          |
| --------- | ------------------------------ |
| `is*`     | Boolean state check            |
| `has*`    | Ownership/existence check      |
| `can*`    | Permission/capability check    |
| `should*` | Recommendation check           |
| `verify*` | Throws on failure              |
| `check*`  | Returns boolean                |
| `ensure*` | Guarantees condition or throws |
