# 아키텍처

이 시드의 핵심은 두 가지입니다. 하나는 **SoLA 계층 분리**이고, 다른 하나는 **분산 환경에서 안전하게 협력하는 구조**입니다. 코드만 보면 왜 이렇게 나누었는지 알기 어려울 수 있어서 문서로 남깁니다.

---

## 1. SoLA — Service-oriented Layered Architecture

### 1.1. 풀려는 문제: 순환 참조

모듈끼리 자유롭게 서로를 부르게 두면 시간이 지날수록 순환 참조가 생깁니다. 처음에는 A만 B를 부르더라도, 기능이 늘면 B도 A를 부르게 되기 쉽습니다. 그러면 A와 B는 사실상 하나로 묶입니다. A를 고치면 B가 흔들리고, B를 고치면 다시 A가 흔들립니다.

### 1.2. 해결책: 같은 계층끼리도 직접 부르지 않습니다

흔한 레이어드 아키텍처는 위 계층이 아래 계층을 부르는 방향만 제한합니다. 같은 계층 안에서는 서로 부르게 두는 경우가 많습니다. 하지만 그렇게 두면 순환 참조가 같은 계층 안에서 다시 생깁니다.

SoLA는 여기서 한 걸음 더 나아갑니다. **같은 계층에 있는 모듈끼리도 직접 부르지 않습니다.** 두 모듈을 함께 써야 한다면, 그 둘을 모두 부를 수 있는 한 단계 위 계층에 조립용 모듈을 만듭니다.

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

의존 규칙은 다음과 같습니다.

1. 같은 계층 안에서는 서로를 참조하지 않습니다.
2. 위 계층은 아래 계층을 참조할 수 있습니다. 예: Application → Core → Infrastructure.
3. 아래 계층은 위 계층의 존재를 알지 못합니다.

이 규칙은 빌드할 때 ESLint의 `no-restricted-imports`로 강제합니다. 설정은 [apps/api/eslint.config.js](../apps/api/eslint.config.js)에 있습니다.

### 1.3. Application Service는 조립이 필요할 때만 만듭니다

Core Service 하나로 처리할 수 있는 API라면 컨트롤러에서 Core를 바로 호출합니다. Application 계층을 억지로 끼워 넣지 않습니다. 여러 Core를 함께 묶어야 하는 유스케이스에서만 Application Service를 만듭니다.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService, // Core
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

SoLA는 원래 마이크로서비스를 염두에 둔 원칙입니다. 마이크로서비스에서는 서비스가 서로 다른 프로세스로 실행됩니다. 그래서 같은 계층끼리 직접 부르기 어렵고, 여러 서비스를 묶는 일은 그 위의 오케스트레이터나 게이트웨이가 맡습니다.

모놀리스에서도 같은 규칙을 모듈 단위로 미리 적용해 두면, 나중에 특정 모듈을 독립 서비스로 떼어내기 쉽습니다. 이미 다른 모듈과 직접 엮여 있지 않기 때문입니다. 코드를 크게 갈아엎지 않고 경계만 끊어낼 수 있습니다.

---

## 2. 분산 협력 — MSA-ready monolith

코드는 하나의 `apps/api` 안에 있습니다. 하지만 배포할 때는 API 컨테이너를 **기본 4개** 띄웁니다. NATS와 Temporal 같은 분산 인프라도 처음부터 사용합니다.

API 컨테이너가 여러 개라면 한 컨테이너 안에서만 생각해서는 안 됩니다. 예를 들어 다음 상황을 처리해야 합니다.

- 여러 컨테이너가 같은 자원을 동시에 수정하려는 상황
- 한 컨테이너에 붙은 클라이언트에게 다른 컨테이너에서 생긴 이벤트를 보내야 하는 상황
- 여러 단계를 거치는 작업이 중간에 실패했을 때 앞 단계 작업을 보상해야 하는 상황

이 시드는 이런 문제를 아래 도구로 풉니다.

| 상황                               | 도구                           | 동작 방식                         |
| ---------------------------------- | ------------------------------ | --------------------------------- |
| 같은 키를 동시에 처리하면 안 될 때 | Redis 분산 락                  | 건너뛰거나 순서대로 처리          |
| 다른 컨테이너의 클라이언트로 알림  | NATS pub/sub                   | 모두에게 보내거나 그룹 안 한 명만 |
| 중간 실패 시 보상해야 하는 작업    | Temporal workflow + activities | 저장·재시도·보상 처리             |

각 도구를 왜 골랐는지, 어떤 대안을 검토했는지는 [decisions.md](decisions.md)에서 설명합니다. 이 문서에서는 도구를 어떻게 쓰는지에 집중합니다.

### 2.1. 분산 락 — `cache.withLock`와 `cache.withLockBlocking`

분산 락은 두 형태로 나누었습니다. 기준은 _이미 다른 요청이 같은 일을 처리 중일 때 어떻게 할 것인가_ 입니다.

- `withLock(key, ttl, fn)`은 이미 락이 점유되어 있으면 바로 `{ran: false}`를 반환하고 종료합니다. 같은 일이 동시에 여러 번 들어와도 한 번만 실행하면 충분한 곳에 사용합니다. 예를 들어 API 컨테이너 4개가 같은 cron을 동시에 시작하더라도, 그중 하나만 실제 작업을 하면 됩니다.
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})`은 락이 해제될 때까지 짧은 간격으로 다시 시도합니다. 요청을 버리지 않고 모두 처리하되, 한 번에 하나씩만 처리해야 할 때 사용합니다. 중복 구매 차단이나 saga의 검증-삽입 경쟁처럼, 그대로 넘기면 사용자 요청을 실패시켜야 하는 곳에 맞습니다.

현재 사용 위치는 다음과 같습니다.

| 위치                                                                                                                          | 유형               | 목적                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------- |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/services/infrastructure/assets/assets.service.ts)                       | `withLock`         | 4개 컨테이너의 cron 중 한 번만 실행            |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/services/application/showtime-creation/temporal/activities.ts) | `withLockBlocking` | 겹치는 시간대 saga의 validate-then-insert 차단 |
| [PurchaseService.processPurchase](../apps/api/src/services/application/purchase/purchase.service.ts)                          | `withLockBlocking` | 같은 티켓 묶음의 중복 구매 차단                |

### 2.2. 컨테이너 사이 메시지 — `NatsPubSubService`

NestJS의 `EventEmitter2`는 같은 프로세스 안에서만 이벤트를 전달합니다. API 컨테이너가 4개인 환경에서는 이것만으로 부족합니다. 예를 들어 Temporal worker가 saga 진행 상황을 만들었는데, SSE 클라이언트가 다른 컨테이너에 붙어 있을 수 있습니다. 이때 이벤트는 컨테이너 밖으로 나가야 합니다.

`NatsPubSubService`는 NATS subject 기반 pub/sub을 감싼 서비스입니다. 같은 subject를 구독하는 모든 컨테이너에 이벤트를 보냅니다. queue group 옵션을 쓰면 같은 그룹 안에서 한 컨테이너만 이벤트를 받게 할 수도 있습니다.

지금은 showtime-creation saga의 상태 변화가 이 경로를 탑니다. saga가 상태를 NATS에 발행하면 모든 컨테이너의 구독 핸들러가 그 이벤트를 받습니다. 각 핸들러는 이벤트를 로컬 RxJS Subject로 넘기고, SSE 컨트롤러는 자기 컨테이너에 붙은 클라이언트에게 흘려보냅니다.

### 2.3. Saga 오케스트레이션 — Temporal

오래 걸리거나 여러 단계를 거치는 작업은 Temporal workflow로 작성합니다. Temporal은 workflow 실행 기록을 서버에 저장합니다. 그래서 워커가 종료되어도 다른 워커가 같은 workflow를 이어서 처리할 수 있습니다. 각 단계의 재시도 규칙도 코드로 적어 둘 수 있습니다.

대신 workflow 함수는 같은 입력이면 항상 같은 결과를 내야 합니다. `Date.now()`, 랜덤 값, 외부 I/O처럼 실행할 때마다 결과가 달라지는 일은 activity로 빼야 합니다. activity가 DB 쓰기나 외부 API 호출을 맡습니다.

현재 [showtimeCreationWorkflow](../apps/api/src/services/application/showtime-creation/temporal/workflows.ts)가 _validate → create → emit_ 흐름을 담당합니다. 중간에 실패하면 catch 블록에서 실패 이벤트를 발행하고, 필요한 보상 작업을 수행합니다.
