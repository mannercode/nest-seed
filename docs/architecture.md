# Architecture Overview

## Monorepo Structure

```
nest-templates/
├── packages/              # Shared libraries (@mannercode/*)
│   ├── common/            # Base utilities (Mongoose, Redis, JWT, S3, Logger)
│   ├── microservice/      # MSA utilities (NATS RPC, Temporal)
│   └── testing/           # Test utilities (HttpTestClient, RpcTestClient)
├── seeds/
│   ├── mono/              # Monolithic NestJS template
│   └── msa/               # Microservice architecture template
├── turbo.json             # Turborepo task pipeline
└── package.json           # npm workspaces root
```

## Package Dependency Graph

```
@mannercode/common          ← No internal dependencies
  └─ @mannercode/microservice  ← Depends on common
       └─ @mannercode/testing     ← Depends on common + microservice
```

## Packages

### @mannercode/common

Foundation layer. Provides infrastructure abstractions reusable across any NestJS application.

| Module         | Key Exports                                                |
| -------------- | ---------------------------------------------------------- |
| **mongoose**   | `MongooseRepository`, `MongooseSchema`, pagination support |
| **redis**      | `RedisModule`, connection management                       |
| **cache**      | `CacheService`, `CacheModule`, namespaced keys, TTL, Lua   |
| **jwt-auth**   | `JwtAuthService`, access/refresh tokens, Redis-backed      |
| **s3**         | `S3ObjectService`, upload/download, presigned URLs         |
| **logger**     | `AppLoggerService`, Winston, exception filter, interceptor |
| **pagination** | `PaginationDto`, `PaginationResult`, `OrderBy`             |
| **health**     | `RedisHealthIndicator`                                     |
| **config**     | `BaseConfigService`                                        |
| **validator**  | `Require`, `Verify`, `ensure()`                            |
| **utils**      | env, base64, byte, checksum, date, time, http, json, path  |

### @mannercode/microservice

Communication and orchestration layer for distributed systems.

| Module       | Key Exports                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **rpc**      | `ClientProxyService`, `ClientProxyModule` — NATS RPC with auto-retry (up to 9 retries, exponential backoff) |
| **temporal** | `TemporalClientModule`, `TemporalWorkerService` — workflow bundling and lifecycle management                |

### @mannercode/testing

Test infrastructure layer.

| Module                | Key Exports                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| **test context**      | `createTestContext()`, `createHttpTestContext()` — isolated NestJS test modules |
| **http test client**  | `HttpTestClient` — fluent API (`.post().body().created()`)                      |
| **rpc test client**   | `RpcTestClient` — `.expectRequest()`, `.expectError()`                          |
| **infra connections** | `getRedisTestConnection()`, `getMongoTestConnection()`, etc.                    |
| **jest utilities**    | Mocking, spying, fake timers helpers                                            |

For architecture details (SoLA, layer responsibilities, domain design), see [seeds/docs/design-guide.md](../seeds/docs/design-guide.md).
