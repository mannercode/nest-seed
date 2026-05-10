# 설계 결정

이 문서는 분산 협력에 쓰는 도구들을 *왜 골랐는지*, 그리고 비슷한 일을 할 수 있는 다른 도구들을 *왜 고르지 않았는지* 를 적는다. 각 도구의 *사용 위치* 는 [architecture.md §2](architecture.md#2-분산-협력--msa-ready-monolith) 에 있으니, 여기서는 판단의 근거에 집중한다.

---

## 1. 분산 락: `cache.withLock` 와 `withLockBlocking` 두 변형

### 결정

여러 replica 가 같은 상태를 두고 경쟁하는 자리는 Redis 의 `SET NX` 와 토큰 기반 Lua `DEL` 로 짠 분산 락으로 보호한다. 그 락을 두 가지 방식으로 쓸 수 있게 메서드를 둘로 갈라 두었다.

- `withLock` — 락을 잡지 못하면 곧바로 포기한다.
- `withLockBlocking` — 락이 풀릴 때까지 폴링하면서 기다리고, 시간이 너무 오래 걸리면 예외를 던진다.

### 두 변형의 선택 기준

어느 쪽을 골라야 할지는 *경합이 일어났을 때 요청을 어떻게 처리하고 싶은가* 로 정해진다.

| 상황                                                  | 선택               |
| ----------------------------------------------------- | ------------------ |
| "한 번만 실행되면 충분" — 예: 같은 cron이 여러 replica에서 발화 | `withLock`         |
| "들어온 요청은 모두 처리하되 한 번에 하나씩"          | `withLockBlocking` |

skip해도 사용자에게 미치는 영향이 없다면 `withLock` 으로 충분하다. 반면 중복 구매를 막거나 saga의 검증-삽입 race를 직렬화해야 하는 자리에서는 skip이 곧 사용자 요청 거절로 이어지므로, `withLockBlocking` 으로 순서대로 흘려보낸다.

### 검토했던 대안

- **Mongo 트랜잭션이나 `findOneAndUpdate` 의 필터** — 한 문서의 상태를 한 번에 바꾸는 일이라면 깔끔하게 풀린다. 하지만 "검증 후 삽입" 처럼 여러 단계를 묶어야 할 때는 트랜잭션을 길게 잡아야 해서 rollback 비용이 커진다.
- **Redlock (Redis 마스터 여러 대 기반 분산 락)** — 우리는 이미 Redis 클러스터 한 곳을 안정적으로 운영하고 있어서, 키 하나에 `SET NX` 만 걸어도 충분하다. Redlock 까지 가는 건 이 환경에서는 과하다.
- **Temporal task queue 의 `concurrency: 1`** — task queue 단위로 동시 실행을 1 로 묶을 수는 있다. 하지만 그러면 그 큐 전체의 처리량이 1 로 묶여 버린다. 우리가 원하는 건 "키별로 순서대로 진행" 인데, 이 옵션으로는 그렇게 짤 수 없다.

---

## 2. Cross-replica 메시지: NATS pub/sub

### 결정

한 프로세스에서 다른 프로세스로 이벤트를 뿌려야 하는 자리는 NATS pub/sub 을 쓰고, 그것을 NestJS provider 로 감싼 `NatsPubSubService` 를 통해서만 쓰도록 표준으로 잡아 두었다. queue group 옵션을 같이 노출해서, 같은 도구로 큐처럼 동작하게 만들 수도 있다.

### 근거

api 는 4 replica 이상으로 늘려서 돈다. NestJS 가 기본으로 제공하는 `EventEmitter2` 는 같은 프로세스 안에서만 이벤트를 전달하므로, 예를 들어 Temporal worker 가 처리한 saga 의 진행 상황을 *다른 replica 에 SSE 로 붙어 있는 클라이언트* 에게 보내려면 다른 replica 로 메시지를 넘길 수 있어야 한다.

NATS 를 고른 이유는 *같은 도구 한 개로* 여러 가지 동작을 다 짤 수 있다는 점이다. 같은 subject 를 그냥 subscribe 하면 모두에게 뿌려지고, 거기에 queue group 을 붙이면 같은 그룹 안에서는 그 중 하나만 받는 부하 분산이 된다. 더 나아가 JetStream consumer 로 가면 영속 큐도 같은 도구 안에서 풀린다. Redis pub/sub 은 모두에게 뿌리는 동작밖에 안 되니, 큐처럼 동작해야 할 때는 BullMQ 같은 별도 도구를 같이 들여야 한다. 도구가 둘로 늘어나면 어디에 어떤 걸 써야 하는지 헷갈릴 일도 같이 늘어난다.

운영하기에도 NATS 는 클러스터링이 단순하고, subject 를 계층 구조로 꾸밀 수 있어서 메시지 경로를 보기 쉽게 짤 수 있다.

### 검토했던 대안

- **`EventEmitter2` 그대로 사용** — 다른 replica 로는 전달이 안 된다. SSE 시나리오 자체가 동작하지 않는다.
- **Redis Pub/Sub** — 직전까지 쓰던 도구라 모두에게 뿌리는 동작은 잘 된다. 다만 큐처럼 동작해야 할 때는 BullMQ 를 따로 들여야 해서, 도구가 둘로 갈리는 부담이 시간이 갈수록 쌓였다.
- **sticky session (nginx)** — 클라이언트의 세션을 한 replica 에 고정하는 방법이지만, worker 가 만들어 내는 이벤트는 여전히 다른 replica 에서 생기니 근본 해법이 아니다.
- **Kafka** — 운영해야 할 게 많다 (broker 3 + controller 3, 토픽을 미리 만들어 둬야 함). 지금 시드 규모에는 과하다.

---

## 3. Saga 오케스트레이션: Temporal workflow

### 결정

처리 시간이 길거나, 부분 실패 시 보상이 필요한 작업은 Temporal workflow와 activity로 표현한다. workflow 함수는 결정적으로 짜고, 모든 부수효과는 activity로 분리한다.

### 근거

직전까지 showtime-creation은 BullMQ 큐 위에 직접 짠 status machine과 수동 `compensate()` 함수로 구현되어 있었다. 이 방식은 saga가 한 단계만 있을 때는 견딜 만하지만, 단계를 더할 때마다 다음 부담이 빠르게 누적된다.

1. **상태를 빠뜨리기 쉽다** — 단계마다 status 를 emit 해야 SSE 가 멈추지 않는데, 한 곳이라도 빠뜨리면 클라이언트가 영원히 기다리는 상태가 된다.
2. **재시도와 멱등성을 직접 챙겨야 한다** — replica 가 죽으면 처리 중이던 작업이 그대로 사라진다. BullMQ 의 ack 만으로는 일부만 진행된 작업을 자동으로 되돌려 주지는 않는다.
3. **밖에서 진행 상황을 따라가기 어렵다** — 단계가 코드 안에만 있어서, 운영 중에 "지금 어디까지 갔지?" 를 보려면 로그를 따라가야 한다.

Temporal 로 옮기면 위 부담이 다음과 같이 줄어든다.

- workflow 의 실행 기록이 자동으로 저장된다. 워커가 죽어도 다른 워커가 같은 자리에서 이어받는다.
- 각 activity 의 재시도 규칙을 코드 한 줄로 적어 둘 수 있다.
- 되돌리는 동작은 workflow 본문의 `try/catch` 안에서 보상 activity 를 부르는 식으로 자연스럽게 풀린다. 별도 상태머신을 직접 짤 필요가 없다.
- Temporal Web UI 에서 workflow 의 현재 위치와 진행 기록을 실시간으로 볼 수 있다.

### 트레이드오프

- workflow 코드는 sandbox 에서 실행되며, 같은 입력이면 언제나 같은 결과가 나오게 짜야 한다. `Date.now()`, 랜덤, 외부 I/O, NestJS DI 처럼 호출할 때마다 결과가 달라질 수 있는 건 workflow 안에서 직접 쓸 수 없고 모두 activity 로 빼야 한다.
- workflow 번들링은 webpack 기반의 `bundleWorkflowCode` 로 이뤄진다. workflow 파일이 import 한 모듈의 transitive import 까지 모두 끌어가므로, NestJS 데코레이터를 쓰는 모듈을 import 하면 번들이 깨진다. 그래서 status enum 같은 값도 NestJS 모듈에 두지 못하고 string literal 로 직접 적어야 한다.
- 인프라가 추가된다. Temporal server와 그 backend인 PostgreSQL이 함께 떠야 한다. 개발과 테스트는 auto-setup 이미지 덕분에 부담이 작지만, 운영 환경에서는 이 두 컨테이너가 추가로 관리 대상이 된다.

### 검토했던 대안

- **BullMQ에 수동 compensate를 계속 사용** — 위에서 적은 부담이 단계 추가에 따라 가속한다.
- **NATS JetStream consumer** — 영속과 재시도는 가능하지만, saga의 보상과 상태머신은 결국 직접 짜야 한다. workflow 라는 추상이 없다.

---

## 4. 명시적으로 거부한 도구

도입을 검토했지만 시드에 포함시키지 않기로 결정한 도구들. 거부 사유를 함께 적어 둔다.

| 도구              | 거부 사유                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Kafka             | NATS 로 충분하다. broker 3 + controller 3 을 운영해야 하는 부담, kafkajs 의 유지보수 종료 (2022), 토픽을 미리 만들어 둬야 하는 비용이 크다. |
| BullMQ            | Temporal 로 갈음했다. saga 의 되돌리기·재시도·상태머신을 직접 짜야 하던 부담을 workflow 가 대신 처리한다.                |
| OpenAPI / Swagger | bash + curl 로 짠 실행 가능한 API 문서 (`apps/api/api-docs/*.spec`) 로 갈음했다. 문서가 거짓이 되는 순간 빌드가 깨지는 살아 있는 문서이고, 데코레이터로 코드를 어지럽히지 않아도 된다. |
| Passport          | NestJS 의 Guard 인터페이스 (`CanActivate`) 를 직접 구현해도 같은 기능을 더 적은 코드로 짤 수 있다. 흐름이 코드에 그대로 드러나서 디버깅도 쉽다. |
| Service Mesh      | 지금 시드의 복잡도를 넘어선다. K8s 로 운영을 옮길 시점에 다시 검토할 만하다.                                              |
