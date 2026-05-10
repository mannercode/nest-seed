# 아키텍처

이 시드의 두 가지 핵심은 **SoLA 계층 분리**와 **분산 협력**이다. 둘 다 코드만 봐서는 *왜 그렇게 짰는지* 가 잘 드러나지 않으므로 별도 문서로 남긴다.

---

## 1. SoLA — Service-oriented Layered Architecture

### 1.1. 풀려는 문제: 순환 참조

모듈끼리 서로 부르는 데 제약이 없으면 시간이 지날수록 사이클이 생긴다. 처음에는 A 가 B 를 부르기만 하던 한 방향 관계였다가, 기능을 더하다 보면 B 도 A 를 부르게 되기 쉽다. 이렇게 되면 두 모듈은 사실상 하나로 붙어 버려서, A 를 고치면 B 도 영향을 받고 B 를 고치면 다시 A 가 영향을 받는다.

### 1.2. 해결책: 같은 계층끼리 부르는 것도 막는다

흔한 레이어드 아키텍처는 위 계층이 아래 계층을 부르는 것만 막고, 같은 계층 안에서는 서로 자유롭게 부르도록 둔다. 그러면 결국 같은 계층 안에서 사이클이 또 자란다. 1.1 에서 말한 그 문제가 한 층 안으로 자리만 옮긴 셈이다.

SoLA 는 여기서 한 발 더 나간다. **같은 계층끼리도 서로 부를 수 없게 막는다.** 두 모듈을 함께 써야 한다면, 둘을 동시에 부를 수 있는 한 단계 위 계층에 새 모듈을 만들어서 거기서 둘을 부른다.

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

SoLA 는 원래 마이크로서비스를 염두에 두고 나온 원칙이다. 마이크로서비스에서는 서비스가 다른 프로세스로 따로 떠 있으니 같은 계층끼리 서로 부르고 싶어도 부를 수 없고, 여러 서비스를 묶어 쓰는 일은 그 위에 있는 별도의 오케스트레이터나 게이트웨이가 맡는다.

모놀리스 안에서 미리 같은 규칙을 모듈 단위로 적용해 두면, 나중에 어떤 모듈을 독립 서비스로 떼어내야 할 때 일이 간단해진다. 이미 다른 모듈과의 직접 참조가 없는 상태라, 코드를 갈아엎지 않고 그대로 떼어낼 수 있다.

---

## 2. 분산 협력 — MSA-ready monolith

코드는 단일 `apps/api` 안에 있지만, 배포는 **4 replica 를 기본** 으로 잡고 NATS 와 Temporal 같은 분산 인프라를 그대로 쓴다. 한 replica 혼자서는 처리할 수 없는 상황 — 여러 replica 가 같은 자원을 동시에 건드릴 때, 다른 replica 에 붙어 있는 클라이언트로 이벤트를 보내야 할 때, 중간에 실패하면 이전 단계를 되돌려야 할 때 — 은 아래 세 가지 도구 중 하나로 풀어낸다.

| 상황                                | 도구                            | 동작 방식                    |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| 같은 키에 동시 진입을 막아야 할 때   | Redis 분산 락                   | 건너뛰거나 줄 세우기          |
| 다른 replica 의 클라이언트로 뿌리기  | NATS pub/sub                    | 모두에게 또는 그룹 안 한 명만 |
| 중간 실패 시 되돌려야 하는 작업     | Temporal workflow + activities  | 저장·재시도·되돌리기         |

각 도구를 *왜* 골랐는지, 어떤 대안을 검토했는지는 [decisions.md](decisions.md) 에서 다룬다. 여기서는 *어떻게* 쓰고 있는지에 집중한다.

### 2.1. 분산 락 — `cache.withLock` 와 `cache.withLockBlocking`

분산 락은 두 가지 형태로 나누어 두었다. 어느 쪽을 골라야 할지는 *경합이 났을 때 어떻게 동작해야 하는가* 로 정해진다.

- `withLock(key, ttl, fn)` — 이미 누가 락을 잡고 있으면 곧장 `{ran: false}` 를 돌려주고 끝낸다. 같은 일이 여러 번 동시에 들어와도 그 중 한 번만 돌면 충분한 상황에 쓴다. 예를 들어 4 개의 replica 가 같은 cron 을 동시에 발동할 때, 그 중 하나만 실제로 실행하고 나머지는 그냥 흘려보낸다.
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})` — 락이 풀릴 때까지 짧은 간격으로 다시 시도하면서 기다린다. 들어온 요청을 빠뜨리지 않고 모두 처리하되, 한 번에 하나씩만 진행해야 할 때 쓴다. 그냥 넘기면 사용자 요청을 거절해야 해서 UX 가 나빠지는 자리 (중복 구매 차단, saga 의 검증-삽입 race) 에 어울린다.

현재 사용 위치는 다음과 같다.

| 위치                                                                                                                              | 유형                | 목적                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/services/infrastructure/assets/assets.service.ts)                          | `withLock`          | 4 replica의 cron 중 한 번만 실행              |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/services/application/showtime-creation/temporal/activities.ts)    | `withLockBlocking`  | 겹치는 시간대 saga의 validate-then-insert 차단 |
| [PurchaseService.processPurchase](../apps/api/src/services/application/purchase/purchase.service.ts)                             | `withLockBlocking`  | 동일 티켓 세트 중복 구매 차단                  |

### 2.2. Cross-replica 메시지 — `NatsPubSubService`

NestJS 에 기본으로 들어 있는 `EventEmitter2` 는 같은 프로세스 안에서만 이벤트가 전달된다. 그런데 4 replica 로 배포된 환경에서는, 예를 들어 Temporal worker 가 처리한 saga 의 진행 상황을 *다른 replica 에 SSE 로 붙어 있는 클라이언트* 에게 보내야 할 때가 생긴다. 한 프로세스에서 다른 프로세스로 이벤트가 가야 하는데, `EventEmitter2` 만으로는 이게 안 된다.

`NatsPubSubService` 는 NATS 의 subject 기반 pub/sub 으로, 같은 subject 를 구독하고 있는 모든 replica 에 이벤트를 한 번에 뿌려 준다. 그냥 구독하면 모두에게 전달되고, queue group 옵션을 붙이면 같은 그룹 안에서는 그 중 하나만 받도록 큐처럼 동작하게 만들 수도 있다.

현재는 showtime-creation saga 의 상태 변화가 이 경로를 탄다. saga 가 진행되면서 상태를 NATS 에 발행하고, 모든 replica 의 구독 핸들러가 이를 받아 로컬 RxJS Subject 로 넘긴 뒤, 각 replica 의 SSE 컨트롤러가 자기에게 붙은 클라이언트로 흘려보낸다.

### 2.3. Saga 오케스트레이션 — Temporal

처리 시간이 길거나, 여러 단계를 거치다가 중간에 실패하면 이전 단계를 되돌려야 하는 작업은 Temporal workflow 로 짠다. Temporal 은 workflow 함수의 실행 기록을 자체 서버에 저장해 두기 때문에, 워커가 죽어도 다른 워커가 같은 workflow 를 이어서 진행할 수 있다. 각 단계의 재시도 규칙도 코드 한 줄로 적어 둘 수 있다.

대신 workflow 함수는 같은 입력이면 언제나 같은 결과가 나오게 짜야 한다 (deterministic). `Date.now()` 나 랜덤 값, 외부 I/O 처럼 호출할 때마다 결과가 달라지는 동작은 모두 activity 로 빼야 한다. activity 가 실제로 DB 에 쓰거나 외부 API 를 호출하는 일을 맡는다.

현재는 [showtimeCreationWorkflow](../apps/api/src/services/application/showtime-creation/temporal/workflows.ts) 가 *validate → create → emit* 흐름을 담당한다. 중간에 실패하면 catch 블록에서 보상 activity를 호출해 이미 만들어진 자원을 정리한다.

> **주의** — workflow 코드는 sandbox 에서 실행되고, `bundleWorkflowCode` 는 webpack 으로 번들을 만들 때 workflow 가 import 한 모듈, 그 모듈이 또 import 한 모듈까지 죄다 끌어간다. 그래서 workflow 파일에서 `@nestjs/common` 같은 데코레이터를 쓰는 모듈을 import 하면 번들이 깨진다. status enum 같은 값도 NestJS 모듈 안에 두지 못하고 string literal 로 직접 적어야 한다.

### 2.4. Replica 식별 — `x-replica-id` 응답 헤더

분산 race 테스트를 돌릴 때, 요청이 실제로 여러 replica 로 나뉘어 갔는지 확인하고 싶을 때가 있다. [bootstrap.ts](../apps/api/src/bootstrap.ts) 의 미들웨어가 모든 HTTP 응답에 `x-replica-id: <os.hostname()>` 를 실어 보내므로, 클라이언트 쪽에서 이 헤더를 모아 보면 replica 분산이 일어났는지 바로 알 수 있다.
