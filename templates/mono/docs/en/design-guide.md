> **English** | [한국어](../ko/design-guide.md)

# Backend Design Guide

---

## 1. Service Architecture — SoLA (Service-oriented Layered Architecture)

### 1.0. System Overview

```
Client ── HTTP ──▶ Gateway ──┬──▶ Applications     (Business logic, async tasks)
                             ├──▶ Cores             (Domain models, data persistence)
                             └──▶ Infrastructures   (External service integrations)
```

| Layer               | Role                                   | Domains                                                                                       |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Gateway**         | API entry point, auth (JWT/Local)      | Customers, Movies, Theaters, Booking, Purchase, ShowtimeCreation                              |
| **Applications**    | Business orchestration                 | ShowtimeCreation, Booking, Purchase, Recommendation                                           |
| **Cores**           | Core domain entities, data persistence | Customers, Movies, Theaters, Showtimes, Tickets, TicketHolding, PurchaseRecords, WatchRecords |
| **Infrastructures** | External service integration           | Payments, Assets(MinIO)                                                                       |

| Component   | Configuration                                     |
| ----------- | ------------------------------------------------- |
| **MongoDB** | 3-node replica set (27017-27019)                  |
| **Redis**   | 6-node cluster, 3 primary + 3 replica (6379-6384) |
| **MinIO**   | S3-compatible object storage (9000, console 9001) |

### 1.1. Problem: Circular References Between Modules

Without restrictions on inter-module references, a relationship that starts as A → B unidirectional can evolve into a circular reference as B → A references are added during feature expansion. When this happens, the two modules become effectively coupled as one. Changing A affects B, and changing B affects A in turn.

### 1.2. Solution: Layer Separation

This project separates modules into three layers and fundamentally prevents circular references. This structure is called SoLA (Service-oriented Layered Architecture).

SoLA was originally designed for microservices architecture (MSA). In MSA, services are physically separated, making direct same-layer references impossible, and service composition is handled by orchestrators or API Gateways. SoLA applies this isolation principle at the module level within a monolith as well.

The reason for applying SoLA in a monolith is that the service can transition to MSA as it grows. By maintaining module isolation from the monolith stage, the cost of breaking code-level dependencies when later extracting a specific module into an independent service is minimized. However, MSA transition involves additional costs beyond code separation, such as network calls, distributed transactions, and data consistency.

A typical layered architecture only forbids upward references (lower → upper) and allows same-layer references. However, SoLA also **forbids references between modules in the same layer**. Allowing same-layer module references can eventually lead to circular dependencies. When multiple modules need to be composed, they must be assembled in an upper layer.

```
┌─────────────────────────────────────────┐
│         Application Services            │  Use case assembly, transaction management
│  ShowtimeCreation, Booking, Purchase    │
├─────────────────────────────────────────┤
│            Core Services                │  Core domain logic
│  Movies, Theaters, Showtimes, Tickets   │
├─────────────────────────────────────────┤
│        Infrastructure Services          │  External system integration
│           Payments, Assets              │
└─────────────────────────────────────────┘
```

**Dependency rules**:

1. **No same-layer references** — Services in the same layer are unaware of each other
2. Only upper layers can reference lower layers (Application → Core → Infrastructure, arrows indicate reference direction)
3. Lower layers are unaware of upper layers

### 1.3. Role of Each Layer

| Layer              | Role                                                                                                  | Can Reference        |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------- |
| **Application**    | Assembles user scenarios (e.g., create showtimes → create tickets). Drives transaction management.    | Core, Infrastructure |
| **Core**           | Handles core domain logic (e.g., movie management, theater management). Each service owns its own DB. | Infrastructure       |
| **Infrastructure** | Handles integration with external systems such as payments and storage.                               | None                 |

Just as objects are classified into Application, Domain, and Infrastructure layers, modules as a whole are divided by the same principle.

### 1.4. Application Service Design

Application Services are created **only when multiple Core Services need to be composed**. APIs that can be handled by a single Core Service call the Core Service directly from the controller.

```
# When Application Service is needed — use cases composing multiple Cores
ShowtimeCreationService   → ShowtimesService + MoviesService + TheatersService + TicketsService
BookingService            → ShowtimesService + TicketsService + TicketHoldingService
PurchaseService           → TicketsService + PurchaseRecordsService + PaymentsService

# When Application Service is unnecessary — a single Core suffices
GET /movies/:id           → MoviesService.getMany()
POST /theaters            → TheatersService.create()
```

Application Services focus on their role as orchestrators. When business logic becomes complex, responsibilities are distributed to internal classes.

#### 1.4.1. Service Injection in Controllers

A single resource controller can inject both Core Services and Application Services. Simple CRUD calls the Core Service, while APIs that compose multiple domains call the Application Service.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService, // Core
        private readonly showtimeCreationService: ShowtimeCreationService // Application
    ) {}

    @Get(':showtimeId')
    async get(@Param('showtimeId') showtimeId: string) {
        return this.showtimesService.getMany([showtimeId]) // Simple query → Core directly
    }

    @Post()
    async create(@Body() body: CreateShowtimesDto) {
        return this.showtimeCreationService.create(body) // Composition needed → Application
    }
}
```

However, when a complex use case consists of multiple APIs and requires an independent entry point, it can be separated into a dedicated controller and namespace (see 2.1).

---

## 2. REST API Design

### 2.1. Resource-Centered Design

REST APIs are designed around **resources**. URL paths are structured based on domain resources, and relationships between resources are expressed through nested paths.

```
GET    /movies                    Resource list
GET    /movies/:id                Resource detail
POST   /movies                    Resource creation
PATCH  /movies/:id                Resource update
DELETE /movies/:id                Resource deletion
GET    /movies/:id/showtimes      Sub-resource query
```

**Complex use cases** can use namespaces. A complex use case is one where a top-level use case is decomposed into multiple sub-use cases, each corresponding to an individual API. In this case, the sub-APIs are not used standalone outside the context of that use case.

```
# Complex use case — using namespace
# "Book Tickets" = search theaters → search show dates → search showtimes → view seats → hold seats
GET  /booking/movies/:id/theaters
GET  /booking/movies/:id/theaters/:id/showdates
GET  /booking/movies/:id/theaters/:id/showdates/:date/showtimes
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# Single resource — no namespace
# Showtime query can be used independently outside booking context
GET  /showtimes/:id
```

Namespaces are not used for single resource CRUD or APIs that are independently meaningful in other contexts.

### 2.2. Long Query Parameters

APIs where query parameters can be lengthy are defined as POST.

```
POST /showtimes/search
{
    "theaterIds": [...]
}
```

### 2.3. Async Requests

Long-running tasks return 202 Accepted and are processed asynchronously. Progress can be delivered to the client via SSE.

```
POST /some-resource        → 202 Accepted { taskId }
SSE  /some-resource/events → { status, taskId }
```

---

## 3. Entity Design

### 3.1. Data Denormalization

Data is appropriately denormalized for query performance and **reduced coupling between layers**.

Storing `movieId` and `theaterId` redundantly in `Ticket` is a representative example. These values also exist in `Showtime`, but without redundant storage, `ShowtimesService` would need to be called for every query.

### 3.2. Entity vs Value Object

The same concept can be either an Entity or a Value Object depending on the domain context.

`Theater.seatmap` is a template for ticket creation. Customers find seats by `Block`, `Row`, and `Number` — they don't need a seat ID — so it is defined as a Value Object.

### 3.3. sagaId

When async bulk operations are needed, a `sagaId` attribute can be added to related entities for tracking and cancellation.

---

## 4. Service Call Flow

REST API calls flow through HTTP controllers that directly inject services.

```
┌──────────────────────────┐        ┌──────────────────────────┐
│    HTTP Controller       ├───────>│         Service          │
└──────────────────────────┘        └──────────────────────────┘
```

```
src/
├── controllers/
│   └── movies.http-controller.ts
│
└── cores/
    └── services/
        └── movies/
            └── movies.service.ts
```

---

## 5. Service Naming Rules

Process-oriented services use singular names; entity management services use plural names.

| Type                       | Example                             | Description                |
| -------------------------- | ----------------------------------- | -------------------------- |
| Process (singular)         | `BookingService`, `PurchaseService` | Handles a specific process |
| Entity management (plural) | `MoviesService`, `TheatersService`  | Handles entity CRUD        |

The `Service` suffix is used **only when a class directly calls other services to perform its work**. When it receives data from the caller and only performs computation, no suffix is added.

```
ShowtimeBulkValidatorService  ← Directly calls Showtimes/Movies/Theaters services
ShowtimeBulkValidator         ← Caller injects data; performs validation computation only
```

---

## 6. Singular/Plural API Design

Query and delete APIs that only take IDs are designed as **plural from the start**. This prevents having to change the API later when batch processing becomes needed.

```ts
// APIs that take only IDs — plural
getMany(theaterIds: string[]) {}
deleteMany(theaterIds: string[]) {}

// Create/update — singular
create(createDto: CreateTheaterDto) {}
update(updateDto: UpdateTheaterDto) {}
```

When a single request is needed from the REST API, the Gateway Controller wraps it in an array.

```ts
@Get(':theaterId')
async getTheater(@Param('theaterId') theaterId: string) {
    return this.theatersService.getMany([theaterId])
}
```

---

## 7. Error Messages

- Must always include a **language-neutral code**. Internationalization is the client's responsibility.
- `message` is briefly described for reference purposes.
- Codes are included **only when the HTTP status is in the 4xx range**. 5xx errors are server failures, so detailed causes are not exposed to clients.

---
