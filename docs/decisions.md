# 설계 결정 기록

프로젝트에서 내린 주요 기술/설계 결정과 그 근거를 기록한다.

> 과거 msa 시드에 해당하던 결정 (NATS, Temporal, Kong) 은 [docs/msa-archive.md](msa-archive.md) 로 옮김. 이 문서는 현재 mono 에 적용되는 결정만 유지한다.

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

- `apis/mono/package.json` — `test` 스크립트
- `package.json` (루트) — `test` 스크립트

---

## 3. Cross-replica 메시지: Redis Pub/Sub

### 결정

Mono 의 SSE 와 같이 프로세스 경계를 넘어 팬아웃이 필요한 이벤트는 **Redis pub/sub** 을 사용하고, 이를 래핑한 `PubSubService` (libs/common) 를 표준 진입점으로 삼는다.

### 근거

mono 는 프로덕션에서 4 replica 로 수평 확장된다. 프로세스 로컬 `EventEmitter2` 는 이벤트가 발행된 replica 의 구독자에게만 전달되므로, 다른 replica 에 붙은 SSE 클라이언트는 상태 변화를 누락한다. showtime-creation 의 saga 진행 상황을 클라이언트에 스트리밍하려면 cross-replica 전달이 필수다.

Redis 는 이미 cache/lock/BullMQ 용으로 스택에 포함되어 있어 추가 인프라 비용이 없다. ioredis 의 subscribe 모드 연결은 다른 명령을 수행할 수 없으므로, `PubSubService` 는 publisher 연결을 `duplicate()` 해서 subscribe 전용 클론을 둔다.

### 대안 검토

- **EventEmitter2 유지**: cross-replica 전달이 안 됨. SSE 사용 불가.
- **NATS 등 별도 브로커 도입**: 브로커를 하나 더 운영해야 함. Redis 로 충분한 요구사항에 과함.
- **sticky session (nginx)**: 세션 경로 고정은 가능하지만 worker 에서 발생한 이벤트는 여전히 cross-replica 여서 근본 해결책이 아님.

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
- `ShowtimeCreationWorkerService.processJobData` — `withLockBlocking`
- `PurchaseService.processPurchase` — `withLockBlocking`

### 대안 검토

- **Mongo 트랜잭션 / findOneAndUpdate 필터**: 원자적 상태 전이만 해결. "검증 후 삽입" 같은 복합 단계는 트랜잭션 수준이라 rollback 복잡도가 올라감.
- **Redlock (다중 Redis 마스터)**: Redis 클러스터는 이미 고가용이라 단일 키 SET NX 로 충분. Redlock 복잡도는 과함.
- **BullMQ concurrency 조정**: replica 내부만 직렬화됨. cross-replica 해결 안 됨.

---
