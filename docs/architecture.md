# 아키텍처

## 1. 모노레포 구조

```
nest-seed/
├── libs/              # 공유 라이브러리 (@mannercode/*)
│   ├── common/            # 기본 유틸리티 (Mongoose, Redis, JWT, S3, Logger)
│   └── testing/           # 테스트 유틸리티 (HttpTestClient)
├── apps/
│   └── api/              # NestJS 시드
└── package.json           # npm workspaces 스크립트
```

> 한때 함께 있던 `apis/msa`, `libs/microservices`, `libs/testing-microservices` 는 2026-04-29 에 제거됨. 자세한 내용은 [docs/msa-archive.md](msa-archive.md).
>
> **MSA-ready monolith**: 코드는 단일 `apps/api` 로 통합됐지만, 4 replica 기본 배포 + NATS/Temporal 같은 분산 인프라는 그대로 유지한다. 즉 코드를 여러 프로젝트로 나누지 않을 뿐 언제든 MSA 로 전환 가능한 모놀리스 구조이며, cross-replica 메시징(NATS pub/sub)과 saga 오케스트레이션(Temporal workflow)은 monolith 안에서도 정상적으로 필요하다.

## 2. 패키지 의존 그래프

```
testing  (독립)
common   (독립)
```

## 3. 패키지 상세

### @mannercode/common

기반 레이어. 모든 NestJS 애플리케이션에서 재사용 가능한 인프라 추상화를 제공한다.

| 모듈           | 주요 export                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **mongoose**   | `CrudRepository`, `CrudSchema`, `AppendOnlyRepository`, `AppendOnlySchema`, 페이지네이션 지원     |
| **redis**      | `RedisModule`, 연결 관리 (single/cluster)                                                         |
| **cache**      | `CacheService`, `CacheModule`, 네임스페이스 키, TTL, Lua, `withLock` / `withLockBlocking` 분산 락 |
| **nats**       | `NatsModule`, `NatsPubSubService`/`NatsPubSubModule`, NATS pub/sub 기반 cross-replica 메시지 팬아웃 (queue group 지원) |
| **temporal**   | `TemporalClientModule`, `TemporalWorkerService`, saga workflow 오케스트레이션 (영속·재시도·보상)  |
| **auth**       | JWT/Local/Optional Guard, `JwtAuthService`, `@Public()` — [상세](auth.md)                         |
| **s3**         | `S3ObjectService`, 업로드/다운로드, presigned URL                                                 |
| **logger**     | `AppLoggerService`, Winston, `HttpExceptionLoggerFilter`, `HttpSuccessLoggerInterceptor`          |
| **pagination** | `PaginationDto`, `PaginationResult`, `OrderBy`                                                    |
| **health**     | `RedisHealthIndicator`                                                                            |
| **config**     | `BaseConfigService`                                                                               |
| **validator**  | `Require`, `Verify`, `ensure()`                                                                   |
| **utils**      | env, base64, byte, checksum, date, time, http, json, path                                         |

### @mannercode/testing

테스트 인프라 레이어.

| 모듈                  | 주요 export                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **test context**      | `createTestContext()`, `createHttpTestContext()` — 격리된 NestJS 테스트 모듈 |
| **http test client**  | `HttpTestClient` — fluent API (`.post().body().created()`)                   |
| **infra connections** | `getRedisTestConnection()`, `getMongoTestConnection()` 등                    |
| **jest utilities**    | Mocking, spying, fake timers 헬퍼                                            |

libs 개발·빌드·테스트·릴리스 워크플로우는 [libs 개발 가이드](libs.md) 참조.

---

## 4. SoLA (Service-oriented Layered Architecture)

### 4.1. 시스템 개요

```
Client ── HTTP ──▶ Gateway ──┬──▶ Applications     (비즈니스 로직, 비동기 작업)
                             ├──▶ Cores             (도메인 모델, 데이터 영속성)
                             └──▶ Infrastructures   (외부 서비스 연동)
```

| Layer               | Role                              | Domains                                                                                       |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| **Gateway**         | API 진입점, 인증(JWT/Local)       | Customers, Movies, Theaters, Booking, Purchase, ShowtimeCreation                              |
| **Applications**    | 비즈니스 오케스트레이션           | ShowtimeCreation, Booking, Purchase, Recommendation                                           |
| **Cores**           | 핵심 도메인 엔터티, 데이터 영속성 | Customers, Movies, Theaters, Showtimes, Tickets, TicketHolding, PurchaseRecords, WatchRecords |
| **Infrastructures** | 외부 서비스 통합                  | Payments, Assets(MinIO)                                                                       |

| Component    | Configuration                                              |
| ------------ | ---------------------------------------------------------- |
| **MongoDB**  | 3-node replica set (27017-27019)                           |
| **Redis**    | 3-node cluster, primary only (6379-6381)                   |
| **MinIO**    | S3-compatible object storage (9000, console 9001)          |
| **NATS**     | single node + JetStream (4222, monitoring 8222)            |
| **Temporal** | server + postgres backend (7233, optional UI 8233)         |

### 4.2. 문제: 순환 참조

모듈(또는 서비스) 간 참조에 제약이 없으면, 처음에는 A → B 단방향이었던 관계가 기능 확장 과정에서 B → A 참조가 추가되어 순환 참조로 발전할 수 있다. 이렇게 되면 둘은 사실상 하나로 묶인다. A를 변경하면 B가 영향을 받고, B를 변경하면 다시 A가 영향을 받는다.

### 4.3. 해결: 계층 분리

이 프로젝트에서는 모듈을 세 계층으로 나누고, 순환 참조를 원천적으로 방지한다. 이 구조를 SoLA(Service-oriented Layered Architecture)라 부른다.

SoLA는 본래 마이크로서비스 아키텍처(MSA)를 대상으로 설계되었다. MSA에서는 서비스가 물리적으로 분리되어 있어 같은 계층 간 직접 참조가 불가능하고, 서비스 조합은 오케스트레이터나 API Gateway가 담당한다. SoLA는 이 격리 원칙을 모놀리스 안에서 모듈 단위로도 적용할 수 있다.

모놀리스에서 SoLA를 적용하는 이유는 서비스가 성장하면 MSA로 전환할 수 있기 때문이다. 모놀리스 단계에서부터 모듈 간 격리를 유지하면, 나중에 특정 모듈을 독립 서비스로 분리할 때 코드 레벨의 의존성을 끊는 비용이 최소화된다. 단, MSA 전환에는 네트워크 호출, 분산 트랜잭션, 데이터 일관성 등 코드 분리 외의 비용이 별도로 존재한다.

일반적인 레이어드 아키텍처는 상위 → 하위 참조만 금지하고 같은 계층 간 참조는 허용한다. 그러나 SoLA는 **동일 계층 간 참조도 금지**한다. 같은 계층의 모듈끼리 참조를 허용하면 결국 순환 참조로 발전할 수 있기 때문이다. 여러 모듈을 조합해야 하는 경우에는 반드시 상위 계층에서 조립한다.

```
┌─────────────────────────────────────────┐
│         Application Services            │  유스케이스 조립, 트랜잭션 관리
│  ShowtimeCreation, Booking, Purchase    │
├─────────────────────────────────────────┤
│            Core Services                │  도메인 기본 로직
│  Movies, Theaters, Showtimes, Tickets   │
├─────────────────────────────────────────┤
│        Infrastructure Services          │  외부 시스템 연동
│           Payments, Assets              │
└─────────────────────────────────────────┘
```

**의존 규칙**:

1. **동일 계층 간 참조 금지** — 같은 계층의 서비스끼리는 서로를 알지 못한다
2. 상위 계층만 하위 계층을 참조 가능 (Application → Core → Infrastructure, 화살표는 참조 방향)
3. 하위 계층은 상위 계층을 알지 못한다

### 4.4. 각 계층의 역할

| 계층               | 역할                                                                                        | 참조 가능 대상       |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------- |
| **Application**    | 사용자 시나리오를 조립한다 (예: 상영시간 생성 → 티켓 생성). 트랜잭션 관리를 주도한다.       | Core, Infrastructure |
| **Core**           | 도메인의 기본 로직을 담당한다 (예: 영화 관리, 극장 관리). 각 서비스는 자신의 DB만 소유한다. | Infrastructure       |
| **Infrastructure** | 결제, 스토리지 등 외부 시스템 연동을 담당한다.                                              | 없음                 |

Application · Domain · Infrastructure 레이어로 객체를 분류하듯이, 모듈 전체도 동일한 원리로 계층을 나누는 것이다.

### 4.5. Application Service 설계

Application Service는 **여러 Core Service를 조합해야 하는 경우**에만 만든다. 단일 Core Service로 처리 가능한 API는 컨트롤러에서 Core Service를 직접 호출한다.

```
# Application Service가 필요한 경우 — 여러 Core를 조합하는 유스케이스
ShowtimeCreationService   → ShowtimesService + MoviesService + TheatersService + TicketsService
BookingService            → ShowtimesService + TicketsService + TicketHoldingService
PurchaseService           → TicketsService + PurchaseRecordsService + PaymentsService

# Application Service가 불필요한 경우 — 단일 Core로 충분
GET /movies/:id           → MoviesService.getMany()
POST /theaters            → TheatersService.create()
```

Application Service는 오케스트레이터 역할에 충실한다. 비즈니스 로직이 복잡해지면 내부 클래스로 책임을 분산시킨다.

#### 컨트롤러의 서비스 주입

하나의 리소스 컨트롤러가 Core Service와 Application Service를 함께 주입할 수 있다. 단순 CRUD는 Core Service를, 여러 도메인을 조합하는 API는 Application Service를 호출한다.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService, // Core
        private readonly showtimeCreationService: ShowtimeCreationService // Application
    ) {}

    @Get(':showtimeId')
    async get(@Param('showtimeId') showtimeId: string) {
        return this.showtimesService.getMany([showtimeId]) // 단순 조회 → Core 직접
    }

    @Post()
    async create(@Body() body: CreateShowtimesDto) {
        return this.showtimeCreationService.create(body) // 조합 필요 → Application
    }
}
```

단, 복합 유스케이스가 여러 API로 구성되어 독립된 진입점이 필요한 경우에는 별도 컨트롤러와 namespace로 분리할 수 있다 ([REST API 설계](design-guide.md#1-리소스-중심-설계) 참조).

---

## 5. 분산 환경 협력

api 는 단일 애플리케이션이지만 프로덕션/테스트에서 **N replica** 로 수평 확장된다. 같은 레플리카가 독점할 수 없는 상태는 Redis 를 매개로 조정한다.

### 5.1. 분산 락 — `cache.withLock` / `cache.withLockBlocking`

- `withLock(key, ttl, fn)` — 경합 시 `{ran: false}` 를 즉시 반환. **중복 실행 방지용** (예: 여러 replica 가 동시에 발화하는 cron 중 하나만 실행).
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})` — 폴링하며 락이 풀릴 때까지 대기. **동시 요청을 직렬화할 때** 사용.

현재 사용 지점:

| 위치                                                                                                                              | 유형                                   | 목적                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/infrastructures/services/assets/assets.service.ts)                          | `withLock`                             | 4 replica 의 cron 중 한 번만 삭제 작업 실행          |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/applications/services/showtime-creation/temporal/activities.ts)    | `withLockBlocking`                     | 겹치는 시간대 saga 의 validate-then-insert race 차단 |
| [PurchaseService.processPurchase](../apps/api/src/applications/services/purchase/purchase.service.ts)                             | `withLockBlocking` (ticketIds 기반 키) | 동일 티켓 세트 중복 구매(double-spend) 차단          |

**선택 기준**: `withLock` 은 "피크에 한 번만" 의미. `withLockBlocking` 은 "모든 요청을 순서대로" 의미. race 를 취소하려면 `withLock`, 직렬화가 필요하면 `withLockBlocking`.

### 5.2. Cross-replica 메시지 — `NatsPubSubService`

프로세스 로컬 `EventEmitter2` 는 요청이 도착한 replica 안에서만 이벤트가 전달된다. 다른 replica 의 SSE 클라이언트로 이벤트를 전달하려면 cross-replica 브로드캐스트가 필요하다.

`NatsPubSubService` 는 NATS subject 기반 pub/sub 으로 모든 구독 replica 에 메시지를 팬아웃한다. queue group 옵션을 주면 같은 그룹 안에서 한 인스턴스만 처리되는 work-queue 의미론도 가능하다. 핸들러 한 개의 throw 가 다른 핸들러 전달을 막지 않도록 격리한다.

현재 사용 지점:

| 위치                                                                                                          | 목적                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [ShowtimeCreationEvents](../apps/api/src/applications/services/showtime-creation/showtime-creation.events.ts) | saga 상태 변화를 NATS subject 로 publish → 모든 replica 의 subscribe 핸들러가 로컬 RxJS Subject 로 포워드 → SSE 컨트롤러가 스트림   |

### 5.3. Saga 오케스트레이션 — `TemporalClient` / `TemporalWorkerService`

장시간 실행되거나 부분 실패 시 보상이 필요한 작업은 Temporal workflow 로 표현한다. workflow 함수는 결정적(deterministic)이어야 하므로 모든 부수효과는 activity 로 분리되고, Temporal server 가 workflow history 를 영속화하면서 재시작·보상·재시도를 보장한다.

현재 사용 지점:

| 위치                                                                                                                                              | 역할                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [showtimeCreationWorkflow](../apps/api/src/applications/services/showtime-creation/temporal/workflows.ts)                                          | validate → create → emitStatusChanged 흐름을 결정적 workflow 로 표현. 실패 시 catch 에서 compensate activity 호출 후 Error 상태 publish |
| [ShowtimeCreationActivities](../apps/api/src/applications/services/showtime-creation/temporal/activities.ts)                                       | DI 주입된 NestJS 서비스로 실제 부수효과 수행 (lock, DB write, NATS publish, 보상 삭제)                                        |
| [ShowtimeCreationOrchestratorService](../apps/api/src/applications/services/showtime-creation/services/showtime-creation-orchestrator.service.ts) | HTTP 요청을 받아 workflow 시작(`temporal.workflow.start`) 후 sagaId 반환                                                      |

`TemporalClientModule.forRootAsync` 는 connection + Client 를 글로벌 provider 로 노출하고, `TemporalWorkerService` 는 task queue + workflowsPath + activities 를 받아 worker 를 부팅한다. workflow 코드는 `bundleWorkflowCode` 로 격리 번들링되므로 `@nestjs/common` 같은 데코레이터 의존성을 끌어들여서는 안 된다 (status enum 도 workflow 내부에서는 string literal 로 표현).

### 5.4. Replica 식별 — `x-replica-id` 응답 헤더

[configure-app.ts](../apps/api/src/config/configure-app.ts) 의 미들웨어가 모든 HTTP 응답에 `x-replica-id: <os.hostname()>` 를 설정한다. 컨테이너 hostname 이 replica 고유 ID 이므로, stress 테스트가 여러 요청이 실제로 서로 다른 replica 에 분산됐는지 검증할 때 사용한다.

---

## 6. 서비스 호출 흐름

HTTP 컨트롤러가 서비스를 직접 주입받아 실행한다.

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

> msa 의 4단계 호출(gateway controller → service client → service controller → service) 는 archive 참조: [docs/msa-archive.md](msa-archive.md).

---

## 7. ESLint 계층 의존성 검증

`eslint.config.js`의 `no-restricted-imports` 규칙으로 SoLA 계층 위반을 빌드 타임에 감지한다.

| 계층              | 참조 금지 대상                                            |
| ----------------- | --------------------------------------------------------- |
| `controllers`     | 없음 (모든 하위 계층 참조 가능)                           |
| `applications`    | `controllers`                                             |
| `cores`           | `controllers`, `applications`                             |
| `infrastructures` | `controllers`, `applications`, `cores`                    |
| `shared`          | `controllers`, `applications`, `cores`, `infrastructures` |

규칙 위반 시 ESLint `warn`으로 보고된다. `npm run lint`로 전체 검사할 수 있다.
