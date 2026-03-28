> **English** | [한국어](../ko/development.md)

# Development Environment Setup

## Environment Files

### `.env`

A configuration file shared between the application and tests. Includes project ID, port, MongoDB/Redis/MinIO connection info, log settings, and more.

Default values point to `host.docker.internal`, so the host IP must be adjusted for different network environments.

### `.env.infra`

Defines Docker image tags used by local infrastructure and Jest Testcontainers.

```env
MONGO_IMAGE=mongo:8.2.3
REDIS_IMAGE=redis:8.4-alpine
MINIO_IMAGE=minio/minio:latest
```

### Renaming the Project

To fork and rename the project, modify two places:

- `PROJECT_ID` in `.env`
- `name` in `package.json`

---

## Dev Container

1. Set up [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) on the host.
2. Run the "Reopen in Container" command in VS Code.
3. The Dev Container uses `.devcontainer/Dockerfile` (base: `node:24-slim`). `postCreateCommand`/`postStartCommand` automatically runs `npm ci` and `npm run infra:reset`.
4. Inside the Dev Container, you can run `npm run test:e2e` immediately without additional environment variable configuration.

---

## VS Code

### Debug (`.vscode/launch.json`)

- **Debug App**: Runs `npm run debug` to debug the app in watch mode.

### Tasks (`.vscode/tasks.json`)

| Task             | Description                                        |
| ---------------- | -------------------------------------------------- |
| `Run Unit Tests` | Runs `npm run test:unit`.                          |
| `Run E2E Tests`  | Runs `npm run test:e2e`. Requires `curl` and `jq`. |

---

## Layer Dependency Rules (ESLint)

The `no-restricted-imports` rules in `eslint.config.js` detect [SoLA layer](design-guide.md#1-service-architecture--sola-service-oriented-layered-architecture) violations at build time.

| Layer (`src/`)    | Restricted References                                     |
| ----------------- | --------------------------------------------------------- |
| `controllers`     | None (can reference all lower layers)                     |
| `applications`    | `controllers`                                             |
| `cores`           | `controllers`, `applications`                             |
| `infrastructures` | `controllers`, `applications`, `cores`                    |
| `shared`          | `controllers`, `applications`, `cores`, `infrastructures` |

Violations are reported as ESLint `warn`. Run `npm run lint` for a full check.

---

## Import Rules

Each folder has an `index.ts` (barrel export) to re-export public APIs. Follow these rules to prevent circular references:

- **Direct ancestor folders** are imported using **relative paths**.

    ```ts
    /* users.service.ts */

    // (X) May cause circular reference
    import { AuthService } from 'src/services'

    // (O) Use relative path
    import { AuthService } from '../auth'
    ```

- **Non-ancestor folders** use **absolute paths**.

    ```ts
    /* users.controller.ts */

    // (O) Use absolute path
    import { AuthService } from 'src/services'

    // (X) Not recommended with relative path
    import { AuthService } from '../services'
    ```

> Having `index.ts` in each folder helps detect circular references earlier.

## Dynamic Import in Tests

Each test generates a unique DB name using `process.env.TEST_ID`.

Jest is configured with `resetModules: true`, and tests use dynamic imports so each test runs in an isolated environment.

```ts
// Type-only imports do not affect runtime
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

## Entry File Structure

The `src/` directory contains the following entry files:

- `development.ts` — Development environment entry
- `main.ts` — Common bootstrap logic
- `production.ts` — Production environment entry

Instead of using `process.env.NODE_ENV` branching in `main.ts`, separate entry files per environment reduce complexity.

```json
// nest-cli.json — development
"entryFile": "development"
```

```js
// webpack.config.js — production build
entry: path.resolve(dirname, 'production.ts')
```

---

## ESM Modules

NestJS uses the CommonJS module system, but Node.js >= 22 supports both CommonJS and ESM simultaneously, so there are no compatibility issues.

However, Jest does not yet fully support ESM, so when using ESM-only modules (e.g., `chalk`), they must be registered in `jest.config.ts`.

```ts
{
    transformIgnorePatterns: ['!node_modules/(?!chalk)']
}
```

---

## Commit Message Rules

Uses `@commitlint/config-conventional` rules. Commit messages must follow the format below; violations will cause the commit to fail.

**Format**: `type: subject` or `type(scope): subject`

| type       | Usage                                      |
| ---------- | ------------------------------------------ |
| `feat`     | Add a feature                              |
| `fix`      | Fix a bug                                  |
| `docs`     | Documentation changes                      |
| `style`    | Format changes with no code meaning change |
| `refactor` | Refactoring                                |
| `perf`     | Performance improvement                    |
| `test`     | Add/modify tests                           |
| `build`    | Build/dependency related                   |
| `ci`       | CI config/script changes                   |
| `chore`    | Miscellaneous tasks                        |
| `revert`   | Revert changes                             |

Examples: `feat: add user login`, `fix(api): handle null pointer in auth`

---

## Adding a New Core Service

Uses `FooService` as an example for adding a Core service. The same pattern applies to Applications/Infrastructures.

### 1. Create Directory and Files

```
src/cores/services/foos/
├── foo.ts                        # Domain model
├── foos.module.ts
├── foos.service.ts
├── foos.repository.ts            # MongoDB repository
├── errors.ts                     # FooErrors constants
├── dto/
│   ├── create-foo.dto.ts
│   └── foo.dto.ts
└── index.ts                      # Public API re-exports
```

### 2. Register the Module

Add `FoosModule` to the `imports` array in `src/cores/cores.module.ts`. `FoosModule` must `exports` `FoosService` for other layers to use it.

```typescript
@Module({
    exports: [FoosService],
    imports: [
        /* ... */
    ],
    providers: [FoosService, FoosRepository]
})
export class FoosModule {}
```

### 3. Use from Gateway

Directly inject and use `FoosService` in Gateway HTTP controllers.

---

## Troubleshooting

### Infrastructure Connection Failure After Dev Container Start

If tests are run before `npm run infra:reset` (executed via `postStartCommand`) completes, connection errors may occur. Wait for `npm run infra:reset` to finish in the terminal before running tests.

### ESLint Layer Rule Violation Warning

If a `Layering rule: ...` message appears, an import path is referencing an incorrect layer. Refer to the layer dependency rules table above and fix the import, or move the logic to the correct layer.

### MongoDB Transaction Error (Local)

Transactions will fail if local MongoDB is not configured as a replica set. Restart infrastructure with `npm run infra:reset` to automatically initialize the 3-node replica set.
