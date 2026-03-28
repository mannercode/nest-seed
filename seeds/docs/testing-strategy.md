# Testing Strategy

## Principles

1. **No mocks** — All tests use real infrastructure (MongoDB, Redis, NATS, MinIO, Temporal)
2. **100% coverage** — Enforced for branches, functions, lines, and statements
3. **Fixture isolation** — Each test suite creates its own isolated context
4. **Real topology** — Clusters match production (replica sets, Redis cluster)

## Test Types

### Unit/Integration Tests (Jest)

Run against real infrastructure started via Docker Compose.

```bash
# mono
cd seeds/mono && npm run infra:reset && npm test

# msa
cd seeds/msa && npm run infra:reset && npm run test:unit
```

**Pattern**: Fixture-based with `createXxxFixture()` factory functions.

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

**Test conventions**:

- `describe` blocks: service/endpoint name
- Conditions: `describe('when X', () => { })` with Korean comment `// ~할 때`
- Assertions: `it('returns X')` with Korean comment `// ~반환한다`
- `beforeEach` establishes the condition; `it` only verifies
- Separate `it` blocks for response validation vs. persistence validation

### E2E Tests (bash + curl + jq)

Full Docker Compose stack — all services + infrastructure.

```bash
npm run test:e2e
```

E2E tests are shell scripts in `tests/e2e/specs/` that validate HTTP API scenarios end-to-end.

## HttpTestClient Fluent API

The `@mannercode/testing` package provides `HttpTestClient` built on superagent.

```typescript
// POST with body, expect 201
await client.post('/movies').body(createDto).created(expectedDto)

// GET with query params, expect 200
await client.get('/movies').query({ title: 'Inception' }).ok(expectedList)

// Expect specific error status
await client.post('/customers').body(duplicateDto).conflict()

// File upload
await client
    .post('/assets')
    .attachments([{ name: 'file', file: buffer }])
    .created()
```

**Available assertions**: `.ok()`, `.created()`, `.accepted()`, `.noContent()`, `.badRequest()`, `.unauthorized()`, `.notFound()`, `.conflict()`, `.payloadTooLarge()`, `.unprocessableEntity()`, `.unsupportedMediaType()`, `.internalServerError()`

## Infrastructure for Tests

Tests connect to infrastructure via environment variables:

| Function                      | Env Variable               |
| ----------------------------- | -------------------------- |
| `getMongoTestConnection()`    | `TESTLIB_MONGO_*`          |
| `getRedisTestConnection()`    | `TESTLIB_REDIS_URL`        |
| `getNatsTestConnection()`     | `TESTLIB_NATS_OPTIONS`     |
| `getTemporalTestConnection()` | `TESTLIB_TEMPORAL_ADDRESS` |
| `getS3TestConnection()`       | `TESTLIB_S3_*`             |

These are configured in `jest.global.ts` which starts test containers and sets the env vars.

## Coverage Configuration

From `jest.config.ts` in both templates:

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

**Excluded from coverage**: `__tests__`, `main.ts`, `*.module.ts`, `index.ts`, `configure-app.ts`, `production.ts`, `development.ts`, `/workflows/`
