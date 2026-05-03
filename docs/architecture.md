# 아키텍처

이 시드의 두 가지 핵심: **SoLA 계층 분리**와 **분산 협력**. 둘 다 코드만 봐서는 *왜* 그렇게 짰는지 안 보이므로 문서로 남긴다.

---

## 1. SoLA — Service-oriented Layered Architecture

모듈을 세 계층으로 나누고 **동일 계층 간 참조도 금지**한다. 같은 계층끼리 참조를 허용하면 결국 순환 참조로 발전하기 때문이다. 여러 모듈을 조합해야 하면 반드시 상위 계층에서 조립한다.

```
┌─────────────────────────────────────────┐
│  Application Services                   │  유스케이스 조립, 트랜잭션 관리
│  ShowtimeCreation, Booking, Purchase    │
├─────────────────────────────────────────┤
│  Core Services                          │  도메인 기본 로직, 자기 DB 소유
│  Movies, Theaters, Showtimes, Tickets   │
├─────────────────────────────────────────┤
│  Infrastructure Services                │  외부 시스템 연동
│  Payments, Assets                       │
└─────────────────────────────────────────┘
```

**의존 규칙**:

1. **동일 계층 간 참조 금지**
2. 상위 → 하위만 가능 (Application → Core → Infrastructure)
3. 하위는 상위를 알지 못함

ESLint `no-restricted-imports`로 빌드 타임에 강제한다 ([eslint.config.js](../eslint.config.js)).

### Application Service는 *조합이 필요할 때만* 만든다

단일 Core Service로 처리 가능한 API는 컨트롤러에서 Core를 직접 호출한다.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService,           // Core
        private readonly showtimeCreationService: ShowtimeCreationService // Application
    ) {}

    @Get(':id')
    async get(@Param('id') id: string) {
        return this.showtimesService.getMany([id])           // 단순 조회 → Core
    }

    @Post()
    async create(@Body() body: CreateShowtimesDto) {
        return this.showtimeCreationService.create(body)      // 조합 필요 → Application
    }
}
```

### 왜 모놀리스에 SoLA 인가

서비스가 성장하면 MSA로 전환할 수 있다. 모놀리스 단계에서부터 모듈 간 격리를 유지하면 나중에 코드 레벨 의존성을 끊는 비용이 작다.

---

## 2. 분산 협력 — MSA-ready monolith

코드는 단일 `apps/api` 지만 **4 replica 기본 배포** + NATS / Temporal 인프라를 유지한다. 같은 replica가 독점할 수 없는 상태는 아래 셋 중 하나로 조정한다.

| 상황                                | 도구                            | 의미론                       |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| 같은 키에 동시 진입을 막아야 함    | Redis 분산 락                   | skip 또는 serialize          |
| 다른 replica의 클라이언트에 팬아웃 | NATS pub/sub                    | broadcast 또는 queue group   |
| 부분 실패 시 보상이 필요한 작업    | Temporal workflow + activities  | 영속·재시도·보상            |

각 도구의 *판단 기준*과 대안 검토는 [decisions.md](decisions.md) 참조.

### 2.1. 분산 락 — `cache.withLock` / `cache.withLockBlocking`

- `withLock(key, ttl, fn)` — 경합 시 `{ran: false}` 즉시 반환. **"피크에 한 번만"** (예: 여러 replica가 같은 cron을 동시에 발화 → 하나만 실행).
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})` — 폴링하며 락 해제 대기. **"모든 요청을 순서대로"** (직렬화).

| 위치                                                                                                                              | 유형                | 목적                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/infrastructures/services/assets/assets.service.ts)                          | `withLock`          | 4 replica의 cron 중 한 번만 실행              |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/applications/services/showtime-creation/temporal/activities.ts)    | `withLockBlocking`  | 겹치는 시간대 saga의 validate-then-insert 차단 |
| [PurchaseService.processPurchase](../apps/api/src/applications/services/purchase/purchase.service.ts)                             | `withLockBlocking`  | 동일 티켓 세트 중복 구매 차단                  |

### 2.2. Cross-replica 메시지 — `NatsPubSubService`

프로세스 로컬 `EventEmitter2`는 이벤트가 발행된 replica 안에서만 전달된다. Temporal worker가 처리한 saga 진행 상황을 다른 replica에 붙은 SSE 클라이언트로 전달하려면 cross-replica 팬아웃이 필요하다.

NATS subject 기반 pub/sub으로 모든 구독 replica에 팬아웃한다. queue group 옵션을 주면 같은 그룹 안에서 한 인스턴스만 처리되는 work-queue 의미론도 가능하다.

현재 사용처: showtime-creation saga의 상태 변화 → 모든 replica의 구독 핸들러 → 로컬 RxJS Subject → SSE 컨트롤러.

### 2.3. Saga 오케스트레이션 — Temporal

장시간 실행되거나 부분 실패 시 보상이 필요한 작업은 Temporal workflow로 표현한다. workflow 함수는 결정적(deterministic)이어야 하므로 모든 부수효과는 activity로 분리되고, Temporal server가 workflow history를 영속화하면서 재시작·보상·재시도를 보장한다.

현재 사용처: [showtimeCreationWorkflow](../apps/api/src/applications/services/showtime-creation/temporal/workflows.ts) — validate → create → emit 흐름. 실패 시 catch에서 compensate activity 호출.

**제약**: workflow 코드는 sandbox에서 실행되므로 `bundleWorkflowCode`가 transitive import까지 끌어간다. workflow 파일은 `@nestjs/common` 같은 데코레이터를 가진 모듈을 import하면 안 된다 (status enum도 string literal로 작성).

### 2.4. Replica 식별 — `x-replica-id` 응답 헤더

[configure-app.ts](../apps/api/src/config/configure-app.ts)의 미들웨어가 모든 HTTP 응답에 `x-replica-id: <os.hostname()>`를 설정한다. 분산 race 테스트가 여러 요청이 실제로 다른 replica에 분산됐는지 검증할 때 사용한다.
