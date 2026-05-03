# 설계 결정 기록

프로젝트에서 내린 주요 기술/설계 결정과 그 근거를 기록한다.

> 과거 msa 시드의 일부 인프라 결정 (Kong, NATS RPC) 은 [docs/msa-archive.md](msa-archive.md) 에 보관한다. NATS pub/sub 과 Temporal 은 2026-05-03 부터 monolith 의 cross-replica 메시징·saga 오케스트레이션 표준으로 다시 도입됐다 ("MSA-ready monolith"). 본 문서는 현재 api 에 적용되는 결정만 유지한다.

---

## 1. ESLint: import 중복 감지 전략

### 결정

- **eslint-plugin-import**를 제거하고, ESLint 내장 `no-duplicate-imports` 규칙을 사용한다.
- `@typescript-eslint/consistent-type-imports` 규칙을 제거하고, `import type` 분리를 강제하지 않는다.

### 근거

- **eslint-plugin-import 제거**: ESLint 9+ Flat Config 공식 지원이 없고, ESLint 10과 peer dependency가 충돌한다. (커밋 `593dce1` → Revert `ae222e0`)
- **consistent-type-imports 제거**: 이 규칙은 `import type`을 별도 줄로 분리하도록 강제하는데, 이렇게 하면 같은 모듈에서 import가 두 줄이 되어 `no-duplicate-imports`와 충돌한다. 서버 앱이라 번들 크기가 중요하지 않고, NestJS DI가 런타임 클래스 참조를 많이 사용하므로 `import type`을 쓸 곳이 적어 실익이 없다.
- **no-duplicate-imports 도입**: 같은 모듈에서 import를 여러 줄로 나누는 것을 감지한다. `consistent-type-imports`를 제거했으므로 충돌 없이 사용할 수 있다.

---

## 2. Node.js 옵션: --experimental-vm-modules

### 결정

테스트 실행 시 `NODE_OPTIONS='--experimental-vm-modules'`를 설정한다.

### 근거

AWS SDK v3 (`@aws-sdk/client-s3` 등)이 내부적으로 dynamic import를 사용하는데, Node.js 24에서 VM 모듈 없이 실행하면 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` 에러가 발생한다. Jest가 VM 환경에서 테스트를 실행하기 때문에 이 플래그가 필요하다.

### 적용 위치

- `apps/api/package.json` — `test` 스크립트
- `package.json` (루트) — `test` 스크립트

---

## 3. Cross-replica 메시지: NATS pub/sub

### 결정

프로세스 경계를 넘어 팬아웃이 필요한 이벤트는 **NATS pub/sub** 을 사용하고, 이를 래핑한 `NatsPubSubService` (libs/common/nats) 를 표준 진입점으로 삼는다. queue group 옵션으로 work-queue 의미론도 지원한다.

### 근거

api 는 프로덕션에서 4+ replica 로 수평 확장된다. 프로세스 로컬 `EventEmitter2` 는 이벤트가 발행된 replica 의 구독자에게만 전달되므로, Temporal worker 가 처리한 saga 의 진행 상황을 다른 replica 에 붙은 SSE 클라이언트로 전달하려면 cross-replica 전달이 필수다.

NATS 를 선택한 이유:

- **명시적 의미론**: subscribe / `subscribe + queue` / JetStream consumer 가 각각 broadcast / load-balance / durable 의미론을 한 도구 안에서 표현. Redis pub/sub 으로는 broadcast 만 가능하고, 다른 의미론은 별도 도구 (BullMQ 등) 필요.
- **MSA-ready monolith 일관성**: 이미 Temporal 을 도입한 만큼 분산 메시징도 MSA 수준 인프라로 통일하는 편이 추후 서비스 분리 시 비용이 작다. 인프라는 유지하고 코드 경계만 분리하면 된다.
- **NATS 자체의 특성**: 클러스터링 단순함, subject 계층, queue group 네이티브 — 운영 단순성과 의미론 표현력이 둘 다 좋음.

### 대안 검토

- **EventEmitter2 유지**: cross-replica 전달이 안 됨. SSE 사용 불가.
- **Redis Pub/Sub (`PubSubService`)**: 직전까지 사용했음. 동작은 하지만 의미론이 broadcast 로만 한정되고, queue 의미론을 위해 BullMQ 를 별도로 둘 수밖에 없어 도구 선택의 인지 부담이 누적됨. NATS 로 통합해 의미론 선택을 도구 API 표면에서 명시적으로 드러냈다.
- **sticky session (nginx)**: 세션 경로 고정은 가능하지만 worker 에서 발생한 이벤트는 여전히 cross-replica 여서 근본 해결책이 아님.
- **Kafka**: NATS 대비 운영 surface 가 큼 (broker3 + controller3, ZK 또는 KRaft). 시드 규모에 과함.

---

## 4. 분산 락: `cache.withLock` / `cache.withLockBlocking`

### 결정

여러 replica 가 같은 상태를 놓고 경쟁하는 구간은 **Redis SET NX + 토큰 기반 Lua DEL** 로 만든 분산 락으로 보호한다. 두 변형을 제공한다.

- `withLock(key, ttl, fn)` — 경합 시 `{ran: false}` 즉시 반환 (skip semantics)
- `withLockBlocking(key, ttl, fn, {pollMs, waitMs})` — 폴링 재시도, 타임아웃 시 예외 (serialize semantics)

### 근거

- **`withLock`**: 여러 replica 가 동일한 cron 을 동시에 발화시키는 상황처럼 "한 번만 실행되면 충분" 할 때. 대기 의미 없음.
- **`withLockBlocking`**: 동시에 들어온 요청을 하나씩 처리해야 할 때 (예: 겹치는 시간대 saga 의 validate-then-insert, 같은 티켓 세트의 중복 구매). skip 하면 요청을 거절해야 하므로 UX 가 나빠진다.

BullMQ 는 `concurrency=1` 이어도 **replica 수만큼 worker** 가 병렬로 돈다. 따라서 worker 단위의 직렬화가 아니라 Redis 수준의 직렬화가 필요하다. 실제로 [4f7a961](https://github.com/mannercode/nest-seed/commit/4f7a961) 이전의 purchase 는 20 동시 요청 중 18 개가 성공해 중복 결제가 발생했다.

### 적용 위치

- `AssetsService.cleanupExpiredUploads` — `withLock`
- `ShowtimeCreationActivities.validateAndCreate` — `withLockBlocking`
- `PurchaseService.processPurchase` — `withLockBlocking`

### 대안 검토

- **Mongo 트랜잭션 / findOneAndUpdate 필터**: 원자적 상태 전이만 해결. "검증 후 삽입" 같은 복합 단계는 트랜잭션 수준이라 rollback 복잡도가 올라감.
- **Redlock (다중 Redis 마스터)**: Redis 클러스터는 이미 고가용이라 단일 키 SET NX 로 충분. Redlock 복잡도는 과함.
- **Temporal task queue 동시성=1**: workflow 내부 직렬화는 가능하지만 task queue 단위로 처리량이 1 로 묶여 throughput 손실. 키별 직렬화는 표현 못 함.

---

## 5. Saga 오케스트레이션: Temporal workflow

### 결정

장시간 실행되거나 부분 실패 시 보상이 필요한 **saga 형 작업은 Temporal workflow + activities** 로 표현한다. workflow 함수는 결정적이고 부수효과는 모두 activity 로 분리한다. workflow 시작은 `TemporalClient.workflow.start(...)`, 워커는 `TemporalWorkerService` 를 NestJS provider 로 등록.

### 근거

직전까지 showtime-creation 은 BullMQ 큐 + 수동 `compensate()` + 직접 작성한 status machine (`Waiting → Processing → Succeeded | Failed | Error`) 로 구현돼 있었다. saga 의 모든 책임을 호출자가 짊어지는 구조라 다음 부담이 누적:

1. **상태 누락 가능성** — emit 호출을 깜빡하면 SSE 가 멈춤
2. **재시도 / 멱등성** — replica 가 죽으면 in-flight job 손실 (BullMQ 의 ack 만으로는 부분 실행 보상 안 됨)
3. **관측성** — 진행 단계가 코드 안에만 있어서 외부 추적 불가

Temporal 로 옮기면:

- workflow history 가 자동 영속화 (replay 가능, 워커 죽어도 다른 워커가 이어 받음)
- activity-level 재시도 정책 선언적으로 표현
- compensate 패턴이 `try/catch` + 보상 activity 로 워크플로 본문 안에 자연스럽게 표현
- Temporal Web UI 로 워크플로 상태 실시간 관찰

### 트레이드오프

- workflow 코드는 sandbox 에서 실행되므로 결정성 규칙 (no `Date.now`, no I/O, no NestJS DI) 을 지켜야 함
- bundleWorkflowCode 가 사용하는 webpack 이 workflow 의 transitive import 까지 끌어가므로, workflow 파일은 NestJS 데코레이터를 가진 모듈을 import 하면 안 됨 (status enum 도 string literal 로 작성)
- 인프라 추가 (Temporal server + postgresql backend); auto-setup 이미지로 dev/test 부담은 작지만 production 운영 surface 증가

### 적용 위치

- `apps/api/src/applications/services/showtime-creation/temporal/workflows.ts` — `showtimeCreationWorkflow`
- `apps/api/src/applications/services/showtime-creation/temporal/activities.ts` — `ShowtimeCreationActivities`
- `apps/api/src/applications/services/showtime-creation/services/showtime-creation-orchestrator.service.ts` — HTTP 진입점에서 workflow 시작
- `libs/common/src/temporal/` — `TemporalClientModule`, `TemporalWorkerService` 통합

### 대안 검토

- **BullMQ + 수동 compensate 유지**: 위 부담 누적. saga 가 한 단계만 있을 땐 견딜 만하지만 단계 추가 시 비용 가속.
- **NATS JetStream consumer**: 영속·재시도는 가능하지만 saga 의 보상·workflow 상태머신을 직접 작성해야 함. workflow 개념 없음.
- **Step Functions / Cadence**: 클라우드 종속 또는 더 작은 생태계.

---
