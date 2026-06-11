# 아키텍처

nest-seed에서 말하는 계층은 컨트롤러/서비스/리포지토리처럼 한 서비스 내부의 코드 구조를 뜻하지 않는다. Application, Core, Infrastructure는 하나의 백엔드 서비스를 제공하기 위해 협력하고, View는 그 서비스를 화면 요구에 맞게 소비한다. 이 규칙은 모듈 사이의 순환 참조를 원천에서 막아, 한쪽을 바꾸면 다른 쪽까지 흔들리는 문제가 생기지 않도록 한다.

---

## 1. SoLA — Service-oriented Layered Architecture

### 1.1. 풀려는 문제: 순환 참조

모듈끼리 자유롭게 서로를 부르게 두면 시간이 지날수록 순환 참조가 생긴다. 처음에는 A만 B를 부르더라도, 기능이 늘면 B도 A를 부르게 되기 쉽다. 그러면 두 모듈은 사실상 하나로 묶이고, 한쪽 수정이 다른 쪽까지 흔든다.

### 1.2. 기존 레이어드와 다른 점

기존 레이어드 아키텍처는 보통 기술적 역할을 기준으로 계층을 나눈다.

```
Controller → Application(Service) → Domain → Repository
```

이 구조에서 Service 계층은 Application 계층이라고도 부른다. 요청 하나의 유스케이스를 처리하고, 트랜잭션 경계를 잡고, Domain이나 Repository를 호출하는 곳이다.

기존 레이어드가 주로 막으려는 것은 Controller가 Repository를 직접 부르거나 Repository가 Controller를 아는 식의 계층 침범이다. 그래서 같은 Application(Service) 계층 안의 모듈 호출은 같은 추상화 수준의 협력으로 보고 허용하는 경우가 많다.

하지만 Service 계층은 쉽게 넓어진다. 한 도메인의 기본 기능, 여러 도메인을 조합하는 유스케이스, 외부 시스템 호출 전 조립 로직이 모두 Service 안에 쌓이면, 같은 계층 안에서도 코드끼리 호출이 얽히고 순환 참조가 생긴다.

SoLA는 이 지점을 나눈다. 기존 Service 계층에 섞이기 쉬운 책임 중, 여러 도메인을 조합하는 유스케이스는 Application Service에 두고, 한 도메인의 규칙과 상태를 책임지는 기능은 Core Service에 둔다. 여기서 Service라는 말은 전통적인 Application Service만 뜻하지 않고, 독립적인 책임을 가진 모듈 단위를 넓게 가리킨다.

### 1.3. 해결책: 같은 계층끼리도 직접 부르지 않는다

흔한 레이어드 아키텍처는 위 계층이 아래 계층을 부르는 방향만 제한한다. 같은 계층 안에서는 서로 부르게 두는 경우가 많다. 하지만 그렇게 두면 같은 계층 안에서 순환 참조가 다시 생긴다.

SoLA는 여기서 한 걸음 더 나아간다. **같은 계층에 있는 모듈끼리도 직접 부르지 않는다.** 두 모듈을 함께 써야 한다면, 그 둘을 모두 부를 수 있는 한 단계 위 계층에 조립용 모듈을 만든다.

```
┌─────────────────────────────────────────┐
│  Gateway                                │  HTTP 진입 (컨트롤러·가드·파이프)
│  *HttpController, AdminAuthGuard        │
├─────────────────────────────────────────┤
│  View Services                          │  화면 전용 서비스 소비자
│  UserHomeView                           │
├─────────────────────────────────────────┤
│  Application Services                   │  여러 도메인 묶는 유스케이스
│  ShowtimeCreation, Booking, Purchase    │  (사가/트랜잭션 포함)
├─────────────────────────────────────────┤
│  Core Services                          │  도메인 로직, 자기 DB 소유
│  Movies, Theaters, Showtimes, Tickets   │
├─────────────────────────────────────────┤
│  Infrastructure Services                │  외부 시스템 연동
│  Payments, Assets                       │
└─────────────────────────────────────────┘
```

Application, Core, Infrastructure는 단일 서비스를 제공하는 협력 관계다. Application은 여러 Core를 묶어 유스케이스를 만들고, Core는 도메인 기능과 상태를 책임지고, Infrastructure는 외부 시스템 연동을 맡는다. Gateway와 View는 이 흐름의 일부가 아니라, 이미 제공되는 서비스를 외부 요청에 맞게 소비하는 계층이다. Gateway는 HTTP 요청을, View는 특정 화면 응답을 책임진다.

의존 규칙은 다음과 같다.

1. 같은 계층 안에서는 서로를 참조하지 않는다.
2. 위 계층만 아래 계층을 참조할 수 있다. 예: Gateway → View → Application → Core → Infrastructure.
3. Gateway와 View는 서비스 소비자이므로 아래 계층의 공개 API를 자유롭게 호출한다. 단 View는 읽기 응답에 집중하고, 상태를 바꾸는 유스케이스는 두지 않는다.
4. 서비스 제공 쪽(Application/Core/Infrastructure)은 Gateway와 View를 참조하지 않는다.

이 규칙은 ESLint로 강제한다. 계층 간 의존 방향은 `eslint-plugin-boundaries`가 막고, 계층별 세부 금지 항목은 `no-restricted-imports`가 막는다. 설정은 [apps/api/eslint.config.js](../apps/api/eslint.config.js)에 있다.

### 1.4. View는 화면 전용 서비스 소비자다

View는 SoLA의 순환 참조 문제를 풀기 위한 핵심 계층이 아니다. 원래라면 프론트엔드가 여러 API를 호출해서 조립해도 되는 화면 전용 읽기 응답을, 효율을 위해 백엔드로 옮겨 온 것이다.

예를 들어 사용자 앱 홈 화면은 추천 영화, 상영시간, 극장 이름을 한 응답에 담아야 한다. 그래서 `view/user-app/home`처럼 화면 단위의 소비자 코드를 백엔드에 둔다. 이렇게 두는 이유와 검토했던 대안은 [설계 결정 §4](decisions.md#4-view-계층-화면-전용-서비스-소비자)에 있다. View는 아래 계층이기만 하면 Application의 읽기 API도 호출할 수 있다.

```
Frontend(User App)
    → Gateway(UserHomeViewHttpController)
        → View(UserHomeViewService)
            → Application(Recommendation)
            → Core(Movies, Showtimes, Theaters)
```

View는 흐름상 최상위에 놓인다. 다만 이것은 프론트엔드가 백엔드를 호출하고, 그 요청을 받은 백엔드가 내부 서비스를 소비하는 자연스러운 흐름의 결과일 뿐이다. View가 서비스 제공 쪽 협력 관계에 포함된다는 뜻은 아니다.

View가 해도 되는 일은 필요한 서비스의 읽기 API를 호출하고, 화면에 맞는 DTO로 묶고, 표시 순서나 개수 같은 조회 정책을 적용하는 것이다. 상태를 바꾸는 유스케이스, 트랜잭션, 도메인 규칙은 View에 두지 않는다. 그런 책임은 Application이나 Core에 둔다.

또한 View는 다른 계층이 재사용하는 공용 서비스가 아니다. 특정 화면 응답에만 쓰이는 소비자 코드이므로, Application/Core/Infrastructure가 View를 참조하지 않는다.

### 1.5. Application Service는 조립이 필요할 때만 만든다

Core Service 하나로 처리할 수 있는 API라면 컨트롤러에서 Core를 바로 호출한다. Application 계층을 억지로 끼워 넣지 않는다. 여러 Core를 함께 써야 하는 유스케이스에서만 Application Service를 만든다.

실제 코드의 두 패턴이 그 예다.

- [movies.http-controller.ts](../apps/api/src/services/gateway/movies.http-controller.ts) — 영화 조회·등록은 Core인 `MoviesService`를 바로 호출한다.
- [showtime-creation.http-controller.ts](../apps/api/src/services/gateway/showtime-creation.http-controller.ts) — 상영 등록은 영화·극장·상영시간·티켓을 한꺼번에 다뤄야 하므로 Application인 `ShowtimeCreationService`를 거친다.

### 1.6. 왜 모놀리스에 SoLA를 쓰는가

SoLA는 원래 마이크로서비스를 염두에 둔 원칙이다. 마이크로서비스에서는 서비스가 서로 다른 프로세스로 실행된다. 같은 계층끼리 직접 부르기 어렵고, 여러 서비스를 묶는 일은 그 위의 오케스트레이터나 게이트웨이가 맡는다.

모놀리스에서도 이 규칙을 모듈 단위로 적용해 두면, 나중에 특정 모듈을 독립 서비스로 떼어내기 쉽다. 다른 모듈과 직접 엮여 있지 않으므로 경계만 끊어낼 수 있다.

---

## 2. 분산 협력 — MSA 준비형 모놀리스

분산 협력의 중심은 `apps/api` 백엔드이다. 저장소에는 Next.js 콘솔(`apps/console`)과 사용자 앱(`apps/user-app`)도 있지만, 배포 문맥에서 복제본으로 띄우고 서로 협력하게 만드는 대상은 API 컨테이너다. API는 배포할 때 **기본 4개** 컨테이너로 실행하고, NATS와 Temporal 같은 분산 인프라도 함께 사용한다.

API 컨테이너가 여러 개라면 한 컨테이너 안에서만 생각해서는 안 된다. 예를 들어 다음 상황을 처리해야 한다.

- 여러 컨테이너가 같은 자원을 동시에 수정하려는 상황
- 한 컨테이너에 붙은 클라이언트에게 다른 컨테이너에서 생긴 이벤트를 보내야 하는 상황
- 여러 단계를 거치는 작업이 중간에 실패했을 때 앞 단계 작업을 보상해야 하는 상황

이 시드는 이런 문제를 아래 도구로 푼다.

| 상황                               | 도구                         | 동작 방식                         |
| ---------------------------------- | ---------------------------- | --------------------------------- |
| 같은 키를 동시에 처리하면 안 될 때 | Redis 분산 락                | 건너뛰거나 순서대로 처리          |
| 다른 컨테이너의 클라이언트로 알림  | NATS pub/sub                 | 모두에게 보내거나 그룹 안 한 명만 |
| 중간 실패 시 보상해야 하는 작업    | Temporal 워크플로 + 액티비티 | 저장·재시도·보상 처리             |

각 도구를 고른 이유와 검토한 대안은 [decisions.md](decisions.md)에 있다. 이 문서에서는 도구를 어디에 어떻게 쓰는지에 집중한다.

### 2.1. 분산 락 — `cache.withLock`와 `cache.withLockBlocking`

분산 락은 두 형태로 나누었다. `withLock(key, ttl, fn)`은 이미 락이 점유되어 있으면 바로 `{ran: false}`를 반환하고 종료한다. `withLockBlocking(key, ttl, fn, {pollMs, waitMs})`은 락이 해제될 때까지 짧은 간격으로 다시 시도하다가, 너무 오래 기다리면 예외를 던진다. 어느 쪽을 고를지의 기준은 [설계 결정 §1](decisions.md#1-분산-락-cachewithlock와-withlockblocking)에 있다.

현재 사용 위치는 다음과 같다.

| 위치                                                                                                                        | 유형               | 목적                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| [AssetsService.cleanupExpiredUploads](../apps/api/src/services/infrastructure/assets/assets.service.ts)                     | `withLock`         | 4개 컨테이너의 cron 중 한 번만 실행                                                  |
| [ShowtimeCreationActivities.validateAndCreate](../apps/api/src/services/application/showtime-creation/worker/activities.ts) | `withLockBlocking` | 겹치는 시간대 사가의 검증 후 삽입 경합 차단                                          |
| [ShowtimeCreationActivities.compensate](../apps/api/src/services/application/showtime-creation/worker/activities.ts)        | `withLockBlocking` | 같은 락 키로 보상과 진행 중 검증·삽입을 직렬화                                       |
| [PurchaseService.processPurchase](../apps/api/src/services/application/purchase/purchase.service.ts)                        | `withLockBlocking` | 동시 결제 직렬화로 불필요한 결제·보상 축소(이중 판매 방지는 티켓의 원자 전이가 보장) |

### 2.2. 컨테이너 사이 메시지 — `NatsPubSubService`

`NatsPubSubService`는 NATS subject 기반 pub/sub을 감싼 서비스이다. 같은 subject를 구독하는 모든 컨테이너에 이벤트를 보내고, 큐 그룹 옵션을 쓰면 같은 그룹 안에서 한 컨테이너만 이벤트를 받는다. 컨테이너 사이 메시지 통로가 필요한 이유와 NATS를 고른 근거는 [설계 결정 §2](decisions.md#2-컨테이너-사이-메시지-nats-pubsub)에 있다.

현재 두 경로가 이 서비스를 탄다.

- **showtime-creation 사가의 상태 브로드캐스트** — 사가가 상태를 NATS에 발행하면 모든 컨테이너의 구독 핸들러가 그 이벤트를 받는다. 각 핸들러는 이벤트를 로컬 RxJS Subject로 넘기고, SSE 컨트롤러는 자기 컨테이너에 붙은 클라이언트에게 흘려보낸다.
- **purchase 이벤트** — 브로드캐스트 구독은 [PurchaseEventLoggerService](../apps/api/src/services/application/purchase/internal/purchase-event-logger.service.ts), 큐 그룹 구독은 [PurchaseNotificationService](../apps/api/src/services/application/purchase/internal/purchase-notification.service.ts)가 예시다.

### 2.3. Saga 오케스트레이션 — Temporal

오래 걸리거나 여러 단계를 거치는 작업은 Temporal 워크플로로 작성한다. 워크플로 함수는 결정적으로 작성하고, DB 쓰기나 외부 API 호출 같은 부수효과는 액티비티로 분리한다. Temporal을 고른 이유와 결정성 제약의 상세는 [설계 결정 §3](decisions.md#3-saga-오케스트레이션-temporal-워크플로)에 있다.

현재 [showtimeCreationWorkflow](../apps/api/src/services/application/showtime-creation/worker/workflow.ts) 워크플로가 _processing emit → validate/create → result emit_ 흐름을 담당한다. `waiting` 이벤트는 워크플로 시작에 성공한 뒤에 오케스트레이터가 발행한다.

중간에 예외가 나면 catch 블록에서 **보상을 먼저 끝내고 나서** `error` 이벤트를 발행한다. 클라이언트에게 `error`는 "정리까지 끝났다"는 신호이므로 이 순서를 바꾸면 안 된다. 보상은 진행 중인 검증·삽입과 같은 분산 락으로 직렬화된다(2.1 표의 compensate 행).
