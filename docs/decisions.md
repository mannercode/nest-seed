# 설계 결정

이 문서는 분산 협력에 쓰는 도구들을 *왜 골랐는지*, 그리고 비슷한 일을 할 수 있는 다른 도구들을 *왜 고르지 않았는지* 를 적는다. 각 도구의 *사용 위치* 는 [architecture.md §2](architecture.md#2-분산-협력--msa-ready-monolith) 에 있으니, 여기서는 판단의 근거에 집중한다.

---

## 1. 분산 락: `cache.withLock` 와 `withLockBlocking` 두 변형

### 결정

여러 replica가 같은 상태를 두고 경쟁하는 구간은 Redis의 `SET NX` 와 토큰 기반 Lua `DEL` 로 구현한 분산 락으로 보호한다. 그 위에 두 가지 사용 패턴을 메서드로 분리해 두었다.

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

- **Mongo 트랜잭션이나 `findOneAndUpdate` 의 필터** — 단일 문서의 원자적 상태 전이는 깔끔하게 풀리지만, "검증 후 삽입" 처럼 여러 단계를 묶어야 하는 경우는 트랜잭션을 길게 잡아야 하고 rollback 비용이 커진다.
- **Redlock (다중 Redis 마스터 기반 분산 락)** — 우리는 이미 Redis 클러스터 한 곳을 안정적으로 운영하고 있어서, 단일 키 `SET NX` 만으로도 충분하다. Redlock의 복잡도는 이 환경에서 과하다.
- **Temporal task queue의 `concurrency: 1`** — task queue 단위로 동시성을 1로 묶을 수는 있지만, 그러면 그 큐 전체의 throughput이 1이 된다. 우리가 원하는 것은 "키별로 순서대로 진행" 인데, 이 옵션으로는 표현되지 않는다.

---

## 2. Cross-replica 메시지: NATS pub/sub

### 결정

프로세스 경계를 넘어 이벤트를 팬아웃해야 하는 자리는 NATS pub/sub을 쓰고, 그것을 NestJS provider로 감싼 `NatsPubSubService` 를 표준 진입점으로 둔다. queue group 옵션을 함께 제공해서, 같은 도구로 work-queue 의미론도 표현할 수 있게 한다.

### 근거

api는 4 replica 이상으로 수평 확장되어 돈다. NestJS 기본의 `EventEmitter2` 는 같은 프로세스 안에서만 이벤트를 전달하므로, 예를 들어 Temporal worker가 처리한 saga의 진행 상황을 *다른 replica에 SSE로 붙은 클라이언트* 에게 전달하려면 cross-replica 전송이 반드시 필요하다.

NATS를 고른 이유는 의미론을 *같은 도구 안에서* 분리해 표현할 수 있다는 점이다. 같은 subject를 그냥 subscribe하면 broadcast가 되고, 거기에 queue group을 붙이면 같은 그룹 안에서는 한 인스턴스만 받는 load-balance가 된다. 더 나아가 JetStream consumer로 가면 영속 큐도 같은 도구로 표현된다. Redis pub/sub은 broadcast밖에 안 되므로, queue 의미론이 필요해지면 BullMQ 같은 별도 도구를 함께 들여야 한다. 도구가 둘로 늘어나면 의미론을 어디서 어떻게 골라야 할지에 대한 인지 부담도 같이 늘어난다.

운영 측면에서도 NATS는 클러스터링이 단순하고 subject에 계층 구조를 둘 수 있어 메시지 라우팅을 직관적으로 짤 수 있다.

### 검토했던 대안

- **`EventEmitter2` 그대로 사용** — cross-replica 전달이 안 된다. SSE 시나리오 자체가 성립하지 않는다.
- **Redis Pub/Sub** — 직전까지 사용했고 broadcast는 잘 동작한다. 다만 큐 의미론이 필요할 때 BullMQ를 별도로 두어야 해서, 도구가 두 개로 갈리는 게 누적 부담이었다.
- **sticky session (nginx)** — 클라이언트의 세션 경로를 한 replica로 고정하는 방법인데, worker가 만들어낸 이벤트는 여전히 다른 replica에서 발생하므로 본질적인 해결책이 아니다.
- **Kafka** — 운영 표면이 크다 (broker 3 + controller 3, 토픽 사전 생성). 지금 시드 규모에는 과하다.

---

## 3. Saga 오케스트레이션: Temporal workflow

### 결정

처리 시간이 길거나, 부분 실패 시 보상이 필요한 작업은 Temporal workflow와 activity로 표현한다. workflow 함수는 결정적으로 짜고, 모든 부수효과는 activity로 분리한다.

### 근거

직전까지 showtime-creation은 BullMQ 큐 위에 직접 짠 status machine과 수동 `compensate()` 함수로 구현되어 있었다. 이 방식은 saga가 한 단계만 있을 때는 견딜 만하지만, 단계를 더할 때마다 다음 부담이 빠르게 누적된다.

1. **상태 누락이 쉬움** — 진행 단계마다 status를 emit해야 SSE가 멈추지 않는데, 한 곳이라도 빠뜨리면 클라이언트가 영원히 기다리는 상태가 된다.
2. **재시도와 멱등성을 직접 관리해야 함** — replica가 죽으면 in-flight job이 손실된다. BullMQ의 ack만으로는 부분 실행에 대한 보상까지 자동으로 해주지 않는다.
3. **외부에서 진행 상황을 추적하기 어려움** — 진행 단계가 코드 안에만 있어서, 운영 중에 "지금 어디까지 갔지?" 를 보려면 로그를 따라가야 한다.

Temporal로 옮기면 위 부담이 다음과 같이 줄어든다.

- workflow의 실행 history가 자동으로 영속화된다. 워커가 죽어도 다른 워커가 같은 지점에서 이어 받아 진행한다.
- 각 activity의 재시도 정책을 선언적으로 표현할 수 있다.
- 보상은 workflow 본문의 `try/catch` 안에서 보상 activity를 호출하는 형태로 자연스럽게 표현된다. 별도 상태머신을 직접 만들 필요가 없다.
- Temporal Web UI에서 workflow의 현재 위치와 history를 실시간으로 볼 수 있다.

### 트레이드오프

- workflow 코드는 sandbox에서 실행되며 결정성을 만족해야 한다. 즉 `Date.now()`, 랜덤, 외부 I/O, NestJS DI 같은 것을 workflow 안에서 직접 쓸 수 없고 모두 activity로 빼야 한다.
- workflow 번들링은 webpack 기반의 `bundleWorkflowCode` 로 이루어진다. workflow 파일이 import 한 모듈의 transitive import까지 모두 끌어가므로, NestJS 데코레이터를 가진 모듈을 import 하면 번들이 깨진다. 그래서 status enum 같은 값도 NestJS 모듈에 두지 못하고 string literal로 직접 작성해야 한다.
- 인프라가 추가된다. Temporal server와 그 backend인 PostgreSQL이 함께 떠야 한다. 개발과 테스트는 auto-setup 이미지 덕분에 부담이 작지만, 운영 환경에서는 이 두 컨테이너가 추가로 관리 대상이 된다.

### 검토했던 대안

- **BullMQ에 수동 compensate를 계속 사용** — 위에서 적은 부담이 단계 추가에 따라 가속한다.
- **NATS JetStream consumer** — 영속과 재시도는 가능하지만, saga의 보상과 상태머신은 결국 직접 짜야 한다. workflow 라는 추상이 없다.

---

## 4. 명시적으로 거부한 도구

도입을 검토했지만 시드에 포함시키지 않기로 결정한 도구들. 거부 사유를 함께 적어 둔다.

| 도구              | 거부 사유                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Kafka             | NATS로 충분하다. broker 3 + controller 3의 운영 부담, kafkajs의 유지보수 종료(2022), 토픽 사전 생성 같은 비용이 크다.   |
| BullMQ            | Temporal로 대체했다. saga의 보상·재시도·상태머신을 직접 짜는 부담을 workflow가 흡수한다.                                |
| OpenAPI / Swagger | bash + curl 기반의 e2e shell spec(`apps/api/tests/e2e/specs/*.spec`)으로 대체했다. 실행 가능한 살아있는 문서이고, 데코레이터로 코드를 어지럽히지 않아도 된다. |
| Passport          | NestJS의 Guard 인터페이스(`CanActivate`)를 직접 구현해도 같은 기능을 더 적은 코드로 표현할 수 있다. 흐름이 명시적이라 디버깅도 쉽다. |
| Service Mesh      | 지금 시드의 복잡도를 넘어선다. K8s로 운영을 옮길 시점에 다시 검토할 만하다.                                              |
