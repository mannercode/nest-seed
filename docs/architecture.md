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

## SoLA (Service-oriented Layered Architecture)

Both templates follow the same layered architecture with strict unidirectional dependency flow.

```
Controllers (Gateway)     ← Authentication, request validation, logging
  ↓
Applications              ← Business logic orchestration, async tasks
  ↓
Cores                     ← Domain entities, repositories
  ↓
Infrastructures           ← External services (payments, S3 storage)
```

Layer boundaries are enforced by ESLint import restriction rules, preventing circular dependencies.

### Layer Responsibilities

| Layer               | Responsibilities                                      | Can Depend On          |
| ------------------- | ----------------------------------------------------- | ---------------------- |
| **Controllers**     | HTTP endpoints, authentication, request validation    | Applications, Cores    |
| **Applications**    | Multi-service orchestration, async jobs, transactions | Cores, Infrastructures |
| **Cores**           | Domain models, repositories, business rules           | Infrastructures        |
| **Infrastructures** | External service integration (payments, S3)           | None                   |

## Template Comparison

### Communication

| Aspect                    | mono                    | msa                               |
| ------------------------- | ----------------------- | --------------------------------- |
| Inter-layer communication | Direct function calls   | NATS RPC (`ClientProxyService`)   |
| Async processing          | BullMQ queues           | Temporal workflows (Saga pattern) |
| Events                    | EventEmitter2 (in-proc) | NATS pub/sub                      |

### Service Decomposition

| Template | Services | Ports                  |
| -------- | -------- | ---------------------- |
| **mono** | 1        | 3000                   |
| **msa**  | 4        | 3000, 4000, 4001, 4002 |

MSA services: Gateway (3000), Applications (4000), Cores (4001), Infrastructures (4002).

### Infrastructure

| Component | mono                  | msa                          |
| --------- | --------------------- | ---------------------------- |
| MongoDB   | 3-node replica set    | 3-node replica set           |
| Redis     | 6-node cluster        | 6-node cluster               |
| NATS      | -                     | 3-node cluster               |
| Temporal  | -                     | Temporal server + PostgreSQL |
| MinIO     | S3-compatible storage | S3-compatible storage        |

## Domain: Movie Ticketing System

Both templates implement the same domain model.

### Modules

| Module             | Responsibility                                  |
| ------------------ | ----------------------------------------------- |
| **Customers**      | Registration, authentication (JWT + Passport)   |
| **Movies**         | Catalog management, publish workflow            |
| **Theaters**       | Theater management                              |
| **Showtimes**      | Showtime scheduling, async batch creation       |
| **Tickets**        | Ticket inventory, holding                       |
| **Booking**        | Seat reservation                                |
| **Purchase**       | Ticket purchase with compensating transactions  |
| **Assets**         | File upload/download (MinIO/S3, presigned URLs) |
| **Payments**       | Payment processing                              |
| **WatchRecords**   | User watch history                              |
| **Recommendation** | Movie recommendations                           |
