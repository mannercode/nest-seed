# 아키텍처

이 시드의 두 가지 핵심은 **SoLA 계층 분리**와 **분산 협력**이다. 둘 다 코드만 봐서는 *왜 그렇게 짰는지* 가 잘 드러나지 않으므로 별도 문서로 남긴다.

---

## 1. SoLA — Service-oriented Layered Architecture

### 1.1. 풀려는 문제: 순환 참조

모듈끼리 참조에 제약이 없으면, 처음에는 A → B 단방향이던 관계가 기능을 더하다가 B → A 까지 추가되면서 순환 참조로 발전하기 쉽다. 이렇게 되면 두 모듈은 사실상 하나로 묶여서, A를 고치면 B가 영향을 받고 B를 고치면 다시 A가 영향을 받는 상태가 된다.

### 1.2. 해결책: 동일 계층 간 참조도 금지

일반적인 레이어드 아키텍처는 *상위 → 하위* 참조만 막고 같은 계층 안에서는 자유롭게 참조하도록 둔다. 그러면 결국 같은 계층 안에서 순환이 자라게 된다. SoLA는 한 발 더 나아가 **같은 계층끼리의 참조도 금지**한다. 여러 모듈을 조합해야 한다면 반드시 한 단계 위 계층에서 조립해야 한다.

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

의존 규칙은 다음과 같다.

1. 같은 계층 안에서는 서로를 참조하지 않는다.
2. 상위 계층은 하위 계층을 참조할 수 있다 (Application → Core → Infrastructure).
3. 하위 계층은 상위 계층의 존재를 알지 못한다.

이 규칙은 ESLint의 `no-restricted-imports` 로 빌드 타임에 강제된다 ([apps/api/eslint.config.js](../apps/api/eslint.config.js)).

### 1.3. Application Service는 *조합이 필요할 때만* 만든다

단일 Core Service만으로 처리할 수 있는 API는 컨트롤러에서 Core를 직접 호출하면 된다. 굳이 Application 계층을 한 단계 더 끼워 넣을 이유가 없다. 여러 Core를 묶어야 하는 유스케이스에서만 Application Service를 도입한다.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService,             // Core
        private readonly showtimeCreationService: ShowtimeCreationService // Application
    ) {}

    @Get(':id')
    async get(@Param('id') id: string) {
        // 단순 조회는 Core를 직접 호출
        return this.showtimesService.getMany([id])
    }

    @Post()
    async create(@Body() body: CreateShowtimesDto) {
        // 영화·극장·상영시간·티켓을 한꺼번에 다뤄야 하므로 Application을 거친다
        return this.showtimeCreationService.create(body)
    }
}
```

### 1.4. 왜 모놀리스에 SoLA를 쓰는가

SoLA는 본래 마이크로서비스를 염두에 두고 만들어진 원칙이다. 마이크로서비스에서는 서비스가 물리적으로 분리되어 있어 같은 계층 간 직접 참조 자체가 불가능하고, 서비스 조합은 별도의 오케스트레이터나 게이트웨이가 맡는다. 모놀리스 안에서 같은 격리를 모듈 단위로 미리 적용해 두면, 나중에 특정 모듈을 독립 서비스로 떼어낼 때 코드 레벨의 의존성을 끊는 비용이 작아진다.

---

## 2. 분산 협력 — MSA-ready monolith

코드는 단일 `apps/api` 안에 있지만, 배포는 **4 replica를 기본**으로 잡고 NATS와 Temporal 같은 분산 인프라를 그대로 쓴다. 같은 replica가 독점할 수 없는 상태(여러 replica가 동시에 건드리는 자원, 다른 replica의 클라이언트에 보내야 할 이벤트, 부분 실패 시 보상이 필요한 작업)는 아래 세 가지 도구 중 하나로 조정한다.

| 상황                                | 도구                            | 의미론                       |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| 같은 키에 동시 진입을 막아야 할 때   | Redis 분산 락                   | skip 또는 serialize          |
| 다른 replica의 클라이언트에 팬아웃   | NATS pub/sub                    | broadcast 또는 queue group   |
| 부분 실패 시 보상이 필요한 작업     | Temporal workflow + activities  | 영속·재시도·보상            |

각 도구를 *왜* 골랐는지, 어떤 대안을 검토했는지는 [decisions.md](decisions.md) 에서 다룬다. 여기서는 *어떻게* 쓰고 있는지에 집중한다.

### 2.1. 분산 락 — `cache.withLock` 와 `cache.withLockBlocking`

분산 락은 두 가지 변형으로 제공한다. 어느 쪽을 골라야 할지는 *경합 시 어떻게 동작해야 하는가* 로 정해진다.

- `withLock(key, ttl, fn)` — 이미 누가 락을 잡고 있으면 곧장 `{ran: false}` 를 반환하고 끝낸다. 그러니까 "피크에 한 번만 실행되면 충분" 한 상황에 쓴다. 예를 들어 4개의 replica가 같은 cron을 동시에 트리거할 때, 그 중 하나만 실제로 실행되게 하고 나머지는 그냥 넘긴다.
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})` — 락이 풀릴 때까지 폴링하면서 기다린다. "들어온 요청을 모두 처리하되 한 번에 하나씩만 진행" 해야 할 때 쓴다. skip해 버리면 사용자 요청을 거절해야 해서 UX가 나빠지는 경우(중복 구매 차단, saga의 검증-삽입 race)에 적합하다.

현재 사용 위치는 다음과 같다.

| 위치                                                                                                                              | 유형                | 목적                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/infrastructures/services/assets/assets.service.ts)                          | `withLock`          | 4 replica의 cron 중 한 번만 실행              |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/applications/services/showtime-creation/temporal/activities.ts)    | `withLockBlocking`  | 겹치는 시간대 saga의 validate-then-insert 차단 |
| [PurchaseService.processPurchase](../apps/api/src/applications/services/purchase/purchase.service.ts)                             | `withLockBlocking`  | 동일 티켓 세트 중복 구매 차단                  |

### 2.2. Cross-replica 메시지 — `NatsPubSubService`

NestJS에 기본으로 들어 있는 `EventEmitter2` 는 같은 프로세스 안에서만 이벤트가 전달된다. 그런데 4 replica로 배포된 환경에서는, 예를 들어 Temporal worker가 처리한 saga의 진행 상황을 *다른 replica에 SSE로 붙어 있는 클라이언트* 에게 보내야 할 때가 생긴다. 이걸 해결하려면 프로세스 경계를 넘는 메시지 전달이 필요하다.

`NatsPubSubService` 는 NATS subject 기반의 pub/sub으로 모든 구독 replica에 이벤트를 팬아웃한다. 같은 subject에 여러 replica가 구독하면 모두에게 전달되고, queue group 옵션을 주면 같은 그룹 안에서는 한 인스턴스만 처리하도록 work-queue 의미론도 표현할 수 있다.

현재는 showtime-creation saga의 상태 변화가 이 경로를 탄다. saga가 진행하면서 상태를 NATS에 발행하고, 모든 replica의 구독 핸들러가 이를 받아 로컬 RxJS Subject로 포워딩한 뒤, 각 replica의 SSE 컨트롤러가 자기에게 붙은 클라이언트로 흘려보낸다.

### 2.3. Saga 오케스트레이션 — Temporal

처리 시간이 길거나, 여러 단계를 거치다가 중간에 실패하면 이전 단계를 보상해야 하는 작업은 Temporal workflow로 표현한다. Temporal은 workflow 함수의 실행 history를 자체 서버에 영속화해 두기 때문에, 워커가 죽어도 다른 워커가 같은 workflow를 이어서 진행할 수 있고, 각 단계의 재시도 정책도 선언적으로 표현할 수 있다.

대신 workflow 함수는 결정적(deterministic)이어야 한다. 즉 같은 입력에 대해 항상 같은 결과를 만들어야 하므로, `Date.now()` · 랜덤 · 외부 I/O 같은 부수효과는 모두 activity로 분리해야 한다. activity가 실제로 DB에 쓰거나 외부 API를 호출하는 부분을 담당한다.

현재는 [showtimeCreationWorkflow](../apps/api/src/applications/services/showtime-creation/temporal/workflows.ts) 가 *validate → create → emit* 흐름을 담당한다. 중간에 실패하면 catch 블록에서 보상 activity를 호출해 이미 만들어진 자원을 정리한다.

> **주의** — workflow 코드는 sandbox에서 실행되며, `bundleWorkflowCode` 가 transitive import까지 webpack으로 번들링한다. 그래서 workflow 파일에서 `@nestjs/common` 같은 데코레이터를 쓰는 모듈을 import 하면 번들이 깨진다. status enum 같은 값도 NestJS 모듈에 정의돼 있으면 안 되고 string literal로 직접 써야 한다.

### 2.4. Replica 식별 — `x-replica-id` 응답 헤더

분산 race 테스트를 돌릴 때, 요청들이 실제로 여러 replica로 나뉘어 갔는지 확인하고 싶을 때가 있다. [configure-app.ts](../apps/api/src/config/configure-app.ts) 의 미들웨어가 모든 HTTP 응답에 `x-replica-id: <os.hostname()>` 를 실어 보내므로, 클라이언트 쪽에서 이 헤더를 모아 보면 replica 분산이 일어났는지 곧바로 알 수 있다.
