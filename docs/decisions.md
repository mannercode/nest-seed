# 설계 결정

분산 협력 도구의 *판단 기준*과 명시적 거부 목록. 채택된 도구의 *사용 위치*는 [architecture.md §2](architecture.md#2-분산-협력--msa-ready-monolith) 참조.

---

## 1. 분산 락: `cache.withLock` vs `withLockBlocking`

### 결정

여러 replica가 같은 상태를 놓고 경쟁하는 구간은 **Redis SET NX + 토큰 기반 Lua DEL**로 만든 분산 락으로 보호한다. 두 변형:

- `withLock` — 경합 시 즉시 skip
- `withLockBlocking` — 폴링 재시도, 타임아웃 시 예외

### 선택 기준

| 상황                                                   | 선택              |
| ------------------------------------------------------ | ----------------- |
| "한 번만 실행되면 충분" (예: cron이 여러 replica에서) | `withLock`        |
| "들어온 요청을 모두 처리하되 직렬화"                    | `withLockBlocking` |

skip하면 요청 거절이라 UX가 나빠지는 경우(중복 구매, saga의 validate-then-insert)는 blocking을 쓴다.

### 대안 검토

- **Mongo 트랜잭션 / `findOneAndUpdate` 필터** — 원자적 상태 전이만 해결. "검증 후 삽입" 같은 복합 단계는 rollback 복잡도가 올라감.
- **Redlock (다중 Redis 마스터)** — 단일 키 SET NX로 충분. Redlock은 과함.
- **Temporal task queue 동시성=1** — task queue 단위로 throughput이 1로 묶임. 키별 직렬화 표현 못함.

---

## 2. Cross-replica 메시지: NATS pub/sub

### 결정

프로세스 경계를 넘어 팬아웃이 필요한 이벤트는 **NATS pub/sub** + 래퍼 `NatsPubSubService`. queue group으로 work-queue 의미론도 같은 도구에서 표현.

### 근거

api는 4+ replica로 수평 확장된다. 프로세스 로컬 `EventEmitter2`로는 다른 replica의 SSE 클라이언트에 도달 못함.

NATS를 선택한 이유:

- **명시적 의미론** — subscribe / `+queue` / JetStream consumer가 broadcast / load-balance / durable 의미론을 한 도구 안에서 표현. Redis pub/sub은 broadcast만 가능해 큐 의미론은 BullMQ를 따로 둘 수밖에 없음.
- **운영 단순성** — 클러스터링 단순, subject 계층, queue group 네이티브.

### 대안 검토

- **EventEmitter2 유지** — cross-replica 전달 불가. SSE 사용 불가.
- **Redis Pub/Sub** — 직전까지 사용. broadcast만 됨, 큐 의미론은 별도 도구 필요.
- **sticky session (nginx)** — 세션 경로 고정은 가능하지만 worker에서 발생한 이벤트는 여전히 cross-replica.
- **Kafka** — broker3 + controller3, 운영 surface가 큼. 시드 규모에 과함.

---

## 3. Saga 오케스트레이션: Temporal workflow

### 결정

장시간 실행되거나 부분 실패 시 보상이 필요한 **saga 형 작업은 Temporal workflow + activities**. workflow는 결정적, 부수효과는 모두 activity로 분리.

### 근거

직전까지 showtime-creation은 BullMQ 큐 + 수동 `compensate()` + 직접 작성한 status machine이었다. 다음 부담이 누적됐다:

1. **상태 누락** — emit 호출을 깜빡하면 SSE 멈춤
2. **재시도/멱등성** — replica가 죽으면 in-flight job 손실
3. **관측성** — 진행 단계가 코드 안에만 있어서 외부 추적 불가

Temporal로 옮기면:

- workflow history 자동 영속화 (워커가 죽어도 다른 워커가 이어 받음)
- activity-level 재시도 정책 선언적
- compensate 패턴이 `try/catch` + 보상 activity로 본문 안에 자연스럽게 표현
- Web UI로 실시간 관찰

### 트레이드오프

- workflow 코드는 sandbox 실행 → 결정성 규칙(no `Date.now`, no I/O, no DI)
- `bundleWorkflowCode`가 transitive import를 끌어가므로 NestJS 데코레이터 모듈 import 금지 (status enum도 string literal)
- 인프라 추가 (Temporal server + postgres backend)

### 대안 검토

- **BullMQ + 수동 compensate** — saga 단계 추가 시 비용 가속.
- **NATS JetStream consumer** — 영속·재시도는 가능하나 saga 보상·상태머신을 직접 작성해야 함.

---

## 4. 명시적 거부

| 기술                  | 거부 사유                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Kafka**             | NATS 채택. broker3+controller3 운영 부담, kafkajs 유지보수 종료(2022), 토픽 사전 생성 비용                              |
| **BullMQ**            | Temporal 채택. saga 보상/재시도/상태머신을 직접 짜는 부담을 workflow가 흡수                                             |
| **OpenAPI / Swagger** | bash + curl e2e shell spec(`apps/api/tests/e2e/specs/*.spec`)으로 대체. 실행 가능한 살아있는 문서, 데코레이터 부담 없음 |
| **Passport**          | NestJS Guard(`CanActivate`) 직접 구현으로 충분. 더 적은 코드, 명시적 흐름                                              |
| **Service Mesh**      | 시드 복잡도 초과. K8s 운영 단계에서 재검토                                                                              |
