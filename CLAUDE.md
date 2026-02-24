# CLAUDE.md

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
