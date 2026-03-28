# nest-templates

NestJS application templates monorepo — movie ticketing domain for monolithic and microservice architectures.

## Project Structure

```
nest-templates/
├── packages/                ← Shared libraries (npm packages)
│   ├── common/              @mannercode/common      — Mongoose, Redis, JWT, S3, logging
│   ├── microservice/        @mannercode/microservice — NATS RPC, Temporal workflows
│   └── testing/             @mannercode/testing      — Test context factories, HTTP/RPC clients
│
├── seeds/                   ← Project seeds (copy one to start a new project)
│   ├── mono/                Monolithic    — NestJS, MongoDB, Redis, BullMQ, EventEmitter2
│   └── msa/                 Microservices — NestJS, MongoDB, Redis, NATS, Temporal
│
└── docs/                    ← Architecture, naming, testing documentation
```

Both templates share the same layered architecture (SoLA) and domain model, but differ in communication and orchestration strategies.

## Documentation

- [Architecture Overview](docs/architecture.md) — Monorepo structure, package graph, SoLA layers, template comparison
- [Naming Conventions](seeds/docs/naming-conventions.md) — Directory naming (common vs shared), file/class/method naming rules
- [Testing Strategy](seeds/docs/testing-strategy.md) — Test principles, fixture patterns, HttpTestClient API, coverage config

## Architecture: SoLA (Service-oriented Layered Architecture)

```
Controllers (Gateway)     ← Authentication, request validation, logging
  ↓
Applications              ← Business logic orchestration, async tasks
  ↓
Cores                     ← Domain entities, repositories
  ↓
Infrastructures           ← External services (payments, S3 storage)
```

Unidirectional dependency flow is enforced by ESLint rules. In the mono template, layers communicate via direct function calls. In the msa template, layers are separate services communicating via NATS RPC.

## Getting Started

### Prerequisites

- Node.js 24+
- Docker & Docker Compose

### 1. Install Dependencies

```bash
npm ci
```

### 2. Build Packages

```bash
npm run build
```

### 3. Run Package Tests

```bash
npm test
```

### 4. Try a Template

```bash
cd seeds/mono   # or seeds/msa
npm ci
npm run infra:reset
npm test
```

See [seeds/docs/development.md](seeds/docs/development.md) for detailed setup, scripts, and project structure.

## Monorepo Scripts

| Script                      | Description                        |
| --------------------------- | ---------------------------------- |
| `npm run build`             | Build all packages (via Turborepo) |
| `npm test`                  | Run package tests with coverage    |
| `npm run lint`              | ESLint across all packages         |
| `npm run format`            | Prettier formatting                |
| `npm run changeset:add`     | Create a changeset for versioning  |
| `npm run changeset:version` | Apply changesets and bump versions |
| `npm run changeset:publish` | Build and publish packages to npm  |

## Tech Stack

| Category            | Technology                 |
| ------------------- | -------------------------- |
| **Framework**       | NestJS 11                  |
| **Language**        | TypeScript 6               |
| **Database**        | MongoDB (Mongoose)         |
| **Cache**           | Redis                      |
| **Messaging**       | NATS (msa)                 |
| **Workflow**        | Temporal (msa)             |
| **Queue**           | BullMQ (mono)              |
| **Events**          | EventEmitter2 (mono)       |
| **Object Storage**  | MinIO (S3-compatible)      |
| **Auth**            | JWT + Passport             |
| **Testing**         | Jest (100% coverage)       |
| **Build**           | Turborepo + Webpack        |
| **Container**       | Docker (multi-stage build) |
| **Package Manager** | npm workspaces             |
| **Versioning**      | Changesets                 |

## Testing Strategy

- **No mocks** — tests use real MongoDB replica sets, Redis clusters, and MinIO via Docker
- **100% coverage threshold** — enforced for branches, functions, lines, and statements
- **Fixture pattern** — isolated test contexts with real infrastructure per test suite
- **E2E tests** — full Docker Compose stack validated through HTTP API (curl + jq)

## Mono vs MSA Comparison

| Aspect                    | mono                       | msa                                    |
| ------------------------- | -------------------------- | -------------------------------------- |
| Services                  | 1 (single process)         | 4 (Gateway, Apps, Cores, Infra)        |
| Inter-layer communication | Direct function calls      | NATS RPC                               |
| Async processing          | BullMQ queues              | Temporal workflows (Saga pattern)      |
| Events                    | EventEmitter2 (in-process) | NATS pub/sub                           |
| Infrastructure            | MongoDB RS + Redis Cluster | + NATS Cluster + Temporal + PostgreSQL |
| Ports                     | 3000                       | 3000, 4000, 4001, 4002                 |

## License

See individual packages for license information.
