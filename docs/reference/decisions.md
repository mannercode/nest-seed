# 설계 결정

이 문서는 시드의 핵심 결정을 **왜 그렇게 했는지** 설명한다. 분산 협력 도구 선택이 주를 이루고, 계층 구조처럼 도구가 아닌 결정도 함께 둔다. 비슷한 일을 할 수 있지만 **쓰지 않기로 한 도구**도 정리한다. 각 결정을 어디에 적용했는지(상황→도구 매핑과 사용 위치)는 [apps 문서](../apps.md)의 분산 협력 절에 있다.

---

## 1. 분산 락: `cache.withLock`와 `withLockBlocking`

### 결정

실행을 한 복제본으로 줄이거나 경쟁 요청의 불필요한 외부 효과를 줄일 때 Redis 분산 락을 쓴다. 구현은 Redis `SET NX`와 토큰 기반 Lua `DEL`을 사용한다. 단, 락 만료·소유 프로세스 종료에도 지켜야 하는 도메인 정합성은 DB 원자 전이·CAS·트랜잭션이 보장한다. 락 사용 방식은 두 가지로 나누었다.

- `withLock` — 락을 획득하지 못하면 바로 포기한다.
- `withLockBlocking` — 락이 해제될 때까지 짧은 간격으로 기다린다. 너무 오래 기다리면 예외를 던진다.

### 두 방식의 선택 기준

기준은 *다른 요청이 이미 같은 일을 처리 중일 때 이번 요청을 어떻게 다룰 것인가*이다.

| 상황                                                              | 선택               |
| ----------------------------------------------------------------- | ------------------ |
| 한 번만 실행되면 충분함. 예: 같은 cron이 여러 컨테이너에서 실행됨 | `withLock`         |
| 들어온 요청은 모두 처리하되, 한 번에 하나씩만 처리해야 함         | `withLockBlocking` |

건너뛰어도 사용자에게 영향이 없는 만료 업로드 정리 cron은 `withLock`으로 한 복제본만 실행한다. 구매 흐름은 같은 티켓 묶음의 요청을 `withLockBlocking`으로 직렬화해, 경쟁에서 진 요청이 결제 생성과 보상까지 진행하는 낭비를 줄인다. 이중 판매 방지 자체는 티켓의 원자 조건부 전이(Available→Sold)가 보장한다.

상영 생성은 Redis 락을 쓰지 않는다. 같은 극장의 동시 작업은 극장 스케줄 guard CAS와 MongoDB 트랜잭션으로 해결한다. 같은 `sagaId`의 중복 제출은 Restate workflow key가 합치지만, 서로 다른 요청의 경쟁은 DB 경계가 처리한다.

### 검토했던 대안

- **Mongo 트랜잭션이나 조건부 갱신** — 락의 대안이자 정합성이 필요한 곳의 기본이다. 티켓 판매는 원자 조건부 전이, 상영 생성은 극장 guard CAS와 트랜잭션을 쓴다. 트랜잭션은 상영 생성 안전 상한 200건과 45초 전체 제한으로 짧게 유지한다.
- **Redlock** — Redis 마스터 여러 대를 전제로 한 분산 락이다. 이 시드는 이미 안정적인 Redis 클러스터 한 곳을 사용한다. 키 하나에 `SET NX`를 거는 방식이면 충분하다.
- **Restate workflow key를 분산 락으로 사용** — 같은 `sagaId`의 재제출에는 맞지만 서로 다른 `sagaId`가 같은 극장 시간을 건드리는 경쟁은 합치지 않는다. workflow key는 HTTP 제출 멱등성을, MongoDB CAS·트랜잭션은 도메인 정합성을 맡는다.

---

## 2. 컨테이너 사이 메시지: NATS pub/sub

### 결정

한 프로세스에서 다른 프로세스로 이벤트를 보내야 하는 곳은 NATS를 사용한다. 저장이 필요 없는 실시간 fan-out은 NestJS 제공자로 감싼 Core NATS `NatsPubSubService`가 맡고, 소비자 중단 중에도 보존해야 하는 구매 완료 알림만 `PurchaseEvents`가 JetStream을 사용한다.

### 근거

API는 기본 4개 컨테이너로 동작한다. NestJS의 `EventEmitter2`는 같은 프로세스 안에서만 이벤트를 전달한다. Restate가 호출한 API endpoint에서 만든 사가 진행 이벤트를 다른 컨테이너에 붙은 SSE(Server-Sent Events) 클라이언트에게 보내려면, 컨테이너 사이 메시지 통로가 필요하다.

NATS를 고른 이유는 한 도구로 여러 동작을 처리할 수 있기 때문이다.

- 같은 subject를 그대로 구독하면 모든 컨테이너가 이벤트를 받는다.
- 큐 그룹을 붙이면 같은 그룹 안에서 한 컨테이너만 이벤트를 받는다.
- JetStream consumer를 쓰면 선택한 이벤트만 저장·ack·재전달할 수 있다.

도구 하나로 브로드캐스트와 큐를 모두 처리하면, 별도 큐 도구를 들일 때보다 선택 기준과 운영 부담이 줄어든다.

운영 면에서도 NATS는 클러스터링이 단순하다. subject를 계층 구조로 만들 수 있어서 메시지 경로도 읽기 쉽다.

### 전달 보장의 경계

상영 생성의 SSE 진행 상태와 구매 관측 로그는 Core NATS pub/sub이다. `publish()` 후 `flush()`는 NATS 서버가 이전 명령을 처리했다는 것만 확인하며, 메시지 저장이나 소비자 처리 ack를 뜻하지 않는다. 현재 연결된 구독자에게 빠르게 보내고 다음 상태 조회로 복구할 수 있는 신호에는 맞지만, 나중에 반드시 처리해야 할 작업 큐로 간주하면 안 된다.

구매 이벤트는 완료된 구매 문서의 `purchaseEventStatus=pending`을 durable outbox로 쓴다. publication lease를 획득한 복제본이 JetStream PubAck를 받은 뒤 MongoDB를 `published`로 갱신한다. 알림 복제본들은 하나의 durable pull consumer를 공유하고 처리 성공 뒤 ack하며, 중단 중 쌓인 이벤트는 복구 후 이어서 처리한다. stream은 exact 구매 subject 하나를 파일에 최대 7일·256 MiB 보존하고 `DiscardNew`를 사용한다. 용량 한계에서는 새 PubAck가 실패하므로 Mongo outbox가 pending으로 남는다.

MongoDB와 JetStream 갱신은 원자적이지 않고 부수 효과와 consumer ack도 원자적이지 않다. `purchaseRecordId` message ID의 10분 중복 억제 구간 밖이거나 ack를 잃으면 같은 이벤트가 다시 전달될 수 있다. 따라서 계약은 at-least-once이고, 실제 부수 효과를 실행하는 소비자는 `purchaseRecordId`를 durable inbox 또는 외부 provider의 idempotency key로 써야 한다. JetStream은 이 선택된 알림 경로에만 사용하며 모든 NATS subject의 기본값으로 확장하지 않는다.

### 검토했던 대안

- **`EventEmitter2` 그대로 사용** — 다른 컨테이너로 이벤트가 가지 않는다. SSE 시나리오가 성립하지 않는다.
- **Redis Pub/Sub** — 모든 구독자에게 뿌리는 용도에는 잘 맞다. 하지만 큐처럼 동작해야 할 때는 BullMQ를 따로 들여야 한다.
- **sticky session(NGINX)** — 클라이언트를 한 컨테이너에 계속 붙이는 방법이다. 하지만 이벤트를 만드는 workflow endpoint가 다른 컨테이너에 있을 수 있으므로 근본적인 해결책은 되지 않는다.
- **Kafka** — 운영해야 할 구성요소가 많다. 지금 시드 규모에는 과하다.

---

## 3. Saga 오케스트레이션: Restate 워크플로

### 결정

시간이 오래 걸리거나 복제본 종료 후에도 이어서 실행해야 하는 일은 Restate 워크플로와 `ctx.run` durable step으로 표현한다. 같은 논리 작업의 `sagaId`를 workflow key로 사용하고, DB 쓰기나 NATS 발행 같은 외부 효과는 이름 있는 step으로 감싼다. 한 DB의 짧은 묶음 쓰기는 workflow 단계별 보상보다 MongoDB 트랜잭션으로 원자적 커밋한다.

### 근거

durable execution runtime 없이 showtime-creation을 만들면 재시도·상태 순서·멱등성·중단 후 재개를 애플리케이션이 각각 관리해야 한다. 사가 단계가 늘면 다음 부담이 빠르게 커진다.

1. **상태 누락이 쉽다** — 단계마다 status를 emit해야 SSE가 이어진다. 한 곳이라도 빠지면 클라이언트가 계속 기다린다.
2. **재시도와 멱등성을 직접 챙겨야 한다** — 컨테이너가 종료되면 처리 중이던 작업이 불완전한 상태로 남을 수 있다. 메시지 ack만으로는 일부만 진행된 외부 효과를 안전하게 이어 갈 수 없다.
3. **진행 상황을 밖에서 보기 어렵다** — 단계가 코드 안에만 있다. 운영 중 “지금 어디까지 갔나?”를 보려면 로그를 따라가야 한다.

Restate로 옮기면 실행 기록과 애플리케이션 코드를 가깝게 두면서 부담이 줄어든다.

- Restate가 workflow key별 invocation과 durable step 결과를 journal에 저장한다. endpoint 복제본이 종료되어도 다른 복제본에서 이어받는다.
- `ctx.run`마다 retry와 timeout을 코드로 적고, `waiting → processing → 종결 상태` 순서도 journal에 남긴다.
- Admin API와 query를 통해 invocation과 journal 상태를 애플리케이션 로그 밖에서 조회할 수 있다.
- 별도 worker bundle·결정성 sandbox 없이 NestJS 제공자와 같은 API 코드에서 workflow endpoint를 제공한다.
- 개발 인프라는 Restate 단일 컨테이너와 volume만 필요하고 별도 workflow DB·schema/namespace setup이 없다.

현재 `validate and create` step은 상영 시간·티켓·`sagaId` operation 기록을 MongoDB 트랜잭션 하나로 묶는다. 극장별 스케줄 guard를 읽기보다 먼저 CAS 갱신해 동시 작업을 WriteConflict로 직렬화하고, 완료된 operation은 재시도 시 결과로 재사용한다. 트랜잭션이 롤백되므로 삭제 보상 step이 없다.

### 트레이드오프

- Journal은 완료된 step 결과를 재사용하지만 외부 효과 성공과 journal 기록 사이의 장애까지 원자적으로 묶지는 않는다. `ctx.run` 함수는 다시 호출될 수 있으므로 MongoDB operation unique key나 외부 provider idempotency key가 여전히 필요하다.
- 상태 이벤트 step도 재시도되므로 같은 이벤트가 중복될 수 있다. Core NATS는 저장·redelivery를 제공하지 않아 SSE 연결 전 이벤트를 복구하지 않는다. MongoDB가 업무 결과의 기준이고 SSE는 진행 알림이다.
- 모든 API 복제본이 HTTP/2 endpoint(:9080)를 열고 Admin API에 배포 URI를 등록해야 한다. 운영에서는 revision별 endpoint와 이전 invocation drain을 설계해야 하며 검증 스택의 고정 NGINX URI만으로 무중단 versioning이 완성되지 않는다.
- Temporal history를 Restate journal로 이관할 수 없다. 운영 execution이 있는 전환은 신규 제출 중지와 drain/cancel을 먼저 해야 한다([deploy 문서](../deploy.md#restate-endpoint-등록과-운영-전환)).

### 검토했던 대안

- **BullMQ에 수동 compensate를 사용** — 사가 단계가 늘수록 보상 처리, 재시도, 상태 관리를 직접 챙겨야 한다.
- **NATS JetStream 컨슈머** — 메시지 저장과 재시도는 가능하다. 하지만 사가의 보상과 상태 머신은 직접 만들어야 한다. 워크플로라는 추상이 없다.
- **Temporal 유지** — durable workflow 기능은 충족하지만 별도 worker bundle·sandbox와 서버용 PostgreSQL·setup 경로가 필요했다. 이 시드의 한 workflow에는 Restate의 서비스 endpoint 방식이 더 작다. 단, 기존 Temporal 운영 history가 있다면 단순 패키지 교체가 아니라 위 direct-cutover 절차가 필요하다.

---

## 4. View 계층: 화면 전용 서비스 소비자

### 결정

여러 도메인 데이터를 한 응답으로 묶어야 하는 화면 전용 읽기 API는 `view/` 계층에 둔다. 예: 사용자 앱 홈은 추천 영화·상영시간·극장 정보를 한 응답에 담아야 하므로 [`view/user-app/home`](../../apps/api/src/services/view/user-app/home/)이 Recommendation(Application)과 Movies/Showtimes/Theaters(Core)를 호출해 화면용 DTO로 묶는다.

### 근거

이 응답은 프론트엔드가 여러 API를 호출해 직접 조립해도 된다. 하지만 그러면 호출 수가 늘고 화면별 조립 로직이 클라이언트에 흩어진다. 백엔드에 화면 단위 소비자 코드를 두면 클라이언트는 요청 한 번으로 화면을 그릴 수 있고, 화면별 조립 로직이 한 곳에 모인다. 서비스 제공 쪽(Application/Core)은 자기 도메인 책임만 지키고, 화면용 응답 모양은 모른 채로 둔다. View 계층의 규칙(허용·금지 책임과 의존 방향)은 [apps 문서](../apps.md#view는-화면-전용-서비스-소비자다)가 정리한다.

### 검토했던 대안

- **GraphQL 게이트웨이** — 클라이언트가 필요한 필드를 직접 고를 수 있다. 하지만 스키마·리졸버·N+1 캐싱·권한 모델을 새로 설계해야 한다. REST 한 엔드포인트로 풀 수 있는 화면 응답에는 과한 도구다.
- **Application 계층에서 화면 DTO 반환** — Application은 사가/트랜잭션 같은 유스케이스 책임을 갖는다. 같은 함수가 화면 응답까지 책임지면 도메인 협력과 화면 요구가 한 자리에 섞여 결합이 늘어난다.
- **프론트엔드에서 여러 API 조립** — 단순한 화면이면 가능하다. 화면이 늘면 같은 조립 로직이 사용자 앱·콘솔에 흩어지고, 백엔드 변경이 여러 곳에 파급된다.

---

## 5. 개발 환경: Dev Container 단일 경로

### 결정

공식 개발 경로는 Dev Container 하나만 둔다. 로컬 직접 실행은 지원하지 않는다.

### 근거

이 시드는 MongoDB Replica Set, Redis Cluster, VersityGW, NATS와 Restate를 함께 띄워야 동작한다. 이 구성을 각자 로컬에서 손으로 맞추게 하면 버전·설정 차이가 곧바로 "내 컴퓨터에서는 되는데"로 이어지고, 문서는 OS별 설치 절차로 불어난다. 컨테이너 정의 하나로 환경을 고정하면 포크한 사람 누구나 같은 환경에서 시작하고, 환경 문제의 디버깅 범위도 컨테이너 안으로 좁혀진다.

인프라 토폴로지도 운영과 같게 둔다. MongoDB 트랜잭션은 Replica Set에서만 동작하고, Redis는 여러 키를 한 명령으로 묶는 호출처럼 Cluster에서만 실패하는 코드가 있다. 개발에서 스탠드얼론으로 줄이면 이런 코드가 운영에 가서야 깨진다.

### 검토했던 대안

- **로컬 직접 실행 병행 지원** — 인프라 기동과 env 주입 경로가 두 벌이 된다. 한쪽만 깨지는 회귀가 생기고, 모든 문서와 스크립트가 두 경로를 설명해야 한다.

---

## 6. 테스트: 커버리지 100% 게이트

### 결정

커버리지를 수집하는 구현 워크스페이스는 100%를 요구한다. 현재 대상은 `apps/api`, `libs/common`, `tools/vitest-helpers`다. 앞의 두 곳은 Vitest V8 coverage를, 변환이 필요 없는 CJS 도구는 `node:test` 내장 coverage를 쓴다. 안정성 반복에서 속도·산출물 절약을 위해 coverage를 끄더라도 정기 AtoZ의 `pnpm run test`에서 반드시 100% 게이트를 별도로 통과한다.

### 근거

커버리지가 100%에 못 미치면 미달분이 익명이 된다. 리포트가 어느 줄이 비었는지 보여 줘도, 그 줄이 의도한 제외인지 누락인지는 구분할 수 없다. 100%에서는 이 구분이 코드에 남는다 — 테스트로 재현할 수 없는 분기는 `istanbul ignore`로 그 자리에 명시되고, 그 밖의 구멍은 그것을 만든 변경에서 게이트가 즉시 실패한다. 도달하기 어려운 분기는 커버리지를 낮출 이유가 아니라 코드를 단순하게 고치라는 신호로 쓴다.

커버리지를 수집하지 않는 테스트도 조용히 예외로 두지 않고 역할을 명시한다.

- `libs/testing`은 테스트 지원 라이브러리다. 헬퍼 대부분이 `libs/common`·`apps/api` 소비자 스펙에서 간접 검증되고, 자체 Vitest는 남은 순수 동작을 검증하지만 coverage를 수집하지 않는다.
- `tests/api-race`는 외부 HTTP/SSE 하네스다. Node 계약 테스트와 4-replica 시나리오, Stability 50회 반복으로 검증하며 앱 코드 커버리지로 포장하지 않는다.
- `tests/web`은 Playwright 브라우저 시나리오와 두 BFF의 브라우저 없는 계약을 검증한다. 브라우저·proxy 행동을 게이트하며 선 커버리지 임계치는 두지 않는다.
- `tools/dev-tools`의 tunnel 정책은 Bash 계약 테스트와 shellcheck로, root `tools/__tests__`의 clean·구성 계약은 AtoZ `test:config`로 검증한다. 여기에는 언어 커버리지 임계치를 붙이지 않는다.

이 구분은 커버리지 임계치를 낮추는 편법이 아니다. 수집 대상 코드에는 100% 외의 임계치가 없고, 수집하지 않는 하네스·계약은 각자의 실제 소비 경로를 통과해야 한다.

### 검토했던 대안

- **임계값 80~90%** — 남는 10~20%가 어디인지 아무도 추적하지 않게 된다. 실제 커버리지가 임계값을 웃도는 동안은 테스트 없는 코드가 추가돼도 게이트가 통과시킨다.

---

## 7. 주 데이터베이스: MongoDB

### 결정

주 데이터베이스는 MongoDB 공식 Node.js driver로 사용한다. 애플리케이션은 단일 `MongoClient`를 공유하고 각 도메인 repository가 collection·index·document 변환을 소유한다.

### 근거

이 시드는 도메인 사이 관계를 DB가 아니라 서비스 코드가 관리한다. 각 서비스는 자기 컬렉션만 소유하고, 다른 도메인의 데이터가 필요하면 그 서비스의 공개 메서드를 호출한다([apps 문서](../apps.md#데이터-비정규화)). 나중에 서비스를 독립시키는 것을 염두에 둔 구조라서([apps 문서](../apps.md)의 분산 협력 절), 외래 키와 조인 같은 DB 레벨 관계는 처음부터 쓰지 않는다. RDB의 핵심 가치를 쓰지 않으니 문서 단위로 읽고 쓰는 MongoDB가 모델 모양과 그대로 맞고, 원자성이 필요한 곳은 MongoDB 트랜잭션으로 처리한다. 트랜잭션의 일시 오류(WriteConflict) 재시도는 드라이버의 `session.withTransaction`에 위임한다 — 손수 만든 고정 횟수 재시도는 부하에서 소진돼 일시 오류가 도메인 결과(409) 대신 5xx로 샜다.

### 검토했던 대안

- **RDB + TypeORM/Prisma** — 관계를 DB 레벨에 두지 않는 설계라 RDB가 주는 것이 없다. 외래 키는 도메인 사이 결합점이 되어, 서비스를 떼어낼 때 DB부터 풀어야 한다.

---

## 8. 구매: durable 상태 머신과 lease 재조정

### 결정

구매는 외부 효과보다 먼저 `pending` 구매 기록을 저장하고, `pending → completing → completed` 또는 `pending/completing → compensating → cancelled`로 수렴하는 durable 상태 머신을 쓴다. 완료·보상·이벤트 발행은 각각 owner ID와 만료 시각이 있는 lease를 CAS로 획득한 복제본만 실행한다. 주기 재조정이 stale 또는 만료된 기록을 다시 처리한다.

### 근거

결제 제공자, Redis 선점 claim, MongoDB 구매·티켓 문서는 하나의 트랜잭션으로 묶이지 않는다. 프로세스가 결제 생성 직후나 티켓 판매 직전에 종료되어도 다시 찾을 durable 기준점이 필요하다. 먼저 만든 `pending` 기록이 그 기준점이다.

완료 경로에서는 티켓 `Available→Sold`, 구매 `completing→completed`, 결제 resolution marker를 MongoDB 트랜잭션 하나로 묶어 일부만 커밋되지 않게 한다. 재조정이 동시에 완료 lease를 회수하려 하면 transaction write conflict와 owner CAS가 승자 하나만 남긴다. 보상 경로는 구매 기록이 소유한 티켓·claim만 멱등으로 해제하고, 구매 ID로 결제를 취소한다. 한 복제본이 보상 중 종료되어도 lease 만료 후 다른 복제본이 이어받는다.

완료된 구매의 `purchaseEventStatus=pending`은 durable outbox다. 이벤트 발행 실패는 구매를 되돌리지 않고 재시도하며, 발행과 DB 갱신 사이 간격 때문에 생길 수 있는 중복은 `purchaseRecordId`를 멱등 키로 써서 소비자가 처리한다(§2의 전달 경계).

### 검토했던 대안

- **요청 코드의 즉시 `catch` 보상만 사용** — 프로세스가 종료되면 `catch`는 실행되지 않는다. 재시작 후 어느 작업을 되돌려야 하는지 알 기준점도 없다.
- **구매 전체를 Restate workflow로 전환** — 가능하지만, 현재 API는 결제 결과를 동기 HTTP 응답으로 줄 수 있고 트랜잭션·lease 상태만으로 종료 상태를 수렴시킬 수 있다. 장기 인간 승인이나 다단계 provider 오케스트레이션이 추가되면 다시 검토한다.

---

## 9. 로그 출력: 구조화 stdout과 Docker 회전

### 결정

개발·테스트는 사람이 읽는 콘솔 포맷을 유지하고 production API는 ECS JSON 한 줄을 stdout/stderr로 내보낸다. NGINX access log도 JSON 한 줄이다. 애플리케이션 컨테이너 안에는 별도 로그 파일을 만들지 않는다.

검증용 Compose의 Docker `json-file`은 컨테이너별 10MB × 3으로 회전한다. 장기 저장·검색 backend와 수집기는 배포 환경마다 다르므로 시드에 포함하지 않는다.

### 근거

- 컨테이너 내부 회전 파일은 영속 volume도 수집기도 없어 교체 때 사라졌고 stdout과 같은 이벤트를 중복 직렬화했다.
- stdout을 단일 계약으로 두면 Docker·Compose·오케스트레이터의 표준 수집 경로를 그대로 쓸 수 있다.
- stdout 뒤의 수집·저장·보존·접근 제어는 실제 배포 환경에서 선택한다. 시드가 특정 로그 backend를 포함하면 사용하지 않는 프로젝트도 이미지·설정·보안 경계를 계속 유지해야 한다.

---

## 10. 명시적으로 거부한 도구

도입을 검토했지만 시드에는 넣지 않기로 한 도구이다. 공통 기준은 도구를 늘리지 않는 것이다 — 새 도구를 학습하는 비용이 도입으로 절감되는 비용보다 크면 넣지 않는다.

| 도구              | 거부 사유                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kafka             | NATS로 충분하다. broker와 controller를 여러 개 운영해야 하고, 토픽을 미리 만들어야 하는 부담이 크다.                                                                      |
| BullMQ            | Restate로 대체했다. 사가의 보상 처리·재시도·상태 머신을 직접 작성해야 하는 부담을 workflow와 durable step이 줄여 준다.                                                    |
| OpenAPI / Swagger | bash + curl로 만든 실행 가능한 API 문서(`apps/api/api-docs/*.spec`)로 대신한다. 문서가 실제 동작과 다르면 검증(`pnpm run atoz`의 `deploy/verify.sh`)이 실패하는 방식이다. |
| Passport          | NestJS의 Guard 인터페이스(`CanActivate`)를 직접 구현해도 충분하다. 코드가 더 짧고 흐름이 바로 보인다.                                                                     |
| Nx / Turborepo    | pnpm workspace로 충분하다. 워크스페이스가 한 자릿수라 빌드 캐시와 작업 그래프가 절감해 주는 시간이 도구를 학습하고 설정을 유지하는 비용에 못 미친다.                      |
| pino              | winston으로 충분하다. 기존 HTTP context·민감정보 redaction·Nest logger 연결을 다시 작성할 만큼 로그 직렬화 처리량이 병목이 아니다.                                        |
| Service Mesh      | 지금 시드에는 과하다. Kubernetes 운영으로 옮기는 시점에 다시 검토할 만하다.                                                                                               |
