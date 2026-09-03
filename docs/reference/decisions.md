# 설계 결정

이 문서는 코드만 보아서는 알기 어려운 **선택 이유, 대안, 보장의 한계**를 남긴다. 정확한 인자·timeout·보존 기간·사용 위치는 구현과 설정이 소유한다.

## 1. 분산 락: `cache.withLock`와 `withLockBlocking`

분산 락은 같은 작업의 중복 실행과 불필요한 외부 효과를 줄이는 데 쓴다. 다른 복제본이 이미 실행 중일 때 건너뛰어도 되는 cron은 non-blocking 락을, 들어온 요청을 결국 처리해야 하는 구매는 blocking 락을 사용한다.

하지만 락은 정합성의 마지막 보루가 아니다. TTL 만료, 프로세스 종료, 네트워크 지연이 있어도 유지되어야 하는 보장은 DB의 원자 조건부 전이·CAS·transaction이 담당한다. 구매 락은 경쟁에서 질 요청의 결제·보상 비용을 줄일 뿐, 이중 판매는 티켓 상태 전이가 막는다.

상영 생성은 Redis 락을 쓰지 않는다. 서로 다른 작업 ID가 같은 극장 시간을 건드리는 경쟁을 MongoDB guard CAS와 transaction이 직접 조정한다. Redlock은 독립 Redis master 여러 개를 운영할 때 검토할 선택지이며 현재 토폴로지에는 불필요하다.

## 2. 컨테이너 사이 메시지: NATS pub/sub

같은 프로세스의 event emitter로는 다른 API 복제본에 붙은 SSE 클라이언트에 이벤트를 전달할 수 없다. NATS를 선택한 이유는 하나의 단순한 메시지 시스템이 fan-out, queue group, 필요한 경로의 보존·ack를 모두 제공하기 때문이다.

전달 보장은 용도에 따라 나뉜다.

- 상영 생성 진행 알림은 손실 시 최종 상태를 재조회할 수 있어 Core NATS로 보낸다. 저장·replay·consumer ack를 보장하지 않는다.
- 구매 완료 이벤트는 나중에도 처리해야 하므로 MongoDB outbox와 JetStream을 사용한다.

DB와 broker, 부수 효과와 ack는 원자적으로 묶이지 않는다. 따라서 구매 이벤트는 at-least-once이며, 소비자가 durable inbox나 provider idempotency key로 중복을 흡수해야 한다. JetStream을 모든 subject의 기본값으로 확장하지 않는 이유도 여기에 있다. 보존이 필요 없는 신호까지 durable stream으로 만들면 운영 상태와 장애 모드만 늘어난다.

Redis Pub/Sub은 fan-out은 해결하지만 durable queue를 위해 다른 도구가 필요하고, Kafka는 현재 규모에 비해 운영 비용이 크다. Sticky session은 이벤트 생성자가 다른 복제본일 수 있어 근본 해결이 아니다.

## 3. Saga 오케스트레이션: Restate 워크플로

오래 걸리거나 복제본 종료 후에도 이어야 하는 작업은 Restate workflow와 durable step으로 표현한다. 이를 애플리케이션 코드로만 만들면 실행 기록, 재시도, 중단 후 재개, 상태 순서, 외부 관측을 각각 구현해야 한다. Restate는 이 책임을 journal과 workflow key로 묶어 드러낸다.

한 DB에 들어가는 짧은 묶음 쓰기는 여러 보상 step으로 쪼개지 않고 MongoDB transaction으로 커밋한다. 반면 DB·Redis·외부 provider처럼 한 transaction으로 묶을 수 없는 효과는 멱등 작업과 상태 머신으로 설계한다.

Durable execution이 exactly-once를 뜻하지는 않는다. 외부 효과는 성공했지만 journal 기록을 잃으면 step이 다시 호출될 수 있다. 그래서 MongoDB operation unique key와 외부 provider의 멱등성이 여전히 필요하다. SSE는 진행 알림일 뿐이고, 최종 상태는 workflow 출력을 재조회하며 업무 결과의 기준은 MongoDB에 둔다.

Temporal도 필요한 durable workflow 기능을 충족하지만, 별도 worker bundle·sandbox·서버 설정을 가져왔다. 현재 시드에서는 NestJS 제공자를 그대로 사용하는 Restate service endpoint가 더 작은 선택이었다. 운영에서는 revision별 endpoint와 기존 invocation drain을 별도로 설계해야 한다.

## 4. View 계층: 화면 전용 서비스 소비자

화면 하나가 여러 도메인의 읽기 API를 필요로 하면 `view/`가 화면 DTO로 조합한다. 프런트엔드의 호출 수와 조합 중복을 줄이되, Application·Core는 화면 형태를 모르게 하기 위해 별도 계층으로 둔다.

View는 읽기 조합과 화면 정책만 담당한다. 도메인 상태 변경·transaction·보상을 두지 않으며, 다른 계층이 View를 재사용하지 않는다. GraphQL은 현재 화면 수에 비해 스키마·resolver·인가·N+1 설계 비용이 크고, frontend에서의 조합은 같은 로직을 여러 클라이언트로 흩어지게 한다. 정확한 계층 규칙은 [apps 문서](../apps.md#view는-화면-전용-서비스-소비자다)가 소유한다.

## 5. 개발 환경: Dev Container 단일 경로

로컬 직접 실행을 별도로 지원하지 않는다. MongoDB Replica Set, Redis Cluster, NATS, Restate, S3 호환 storage의 버전·topology·env 주입 경로를 OS별로 두 벌 유지하면 환경 차이 자체가 주요 장애 원인이 된다.

특히 transaction은 Replica Set에서, 여러 Redis key를 묶는 작업은 Cluster에서만 드러나는 제약이 있다. 개발 토폴로지를 스탠드얼론으로 줄이면 운영에서만 깨지는 코드를 만들 수 있다. 단일 Dev Container 경로는 이 차이를 줄이고 문서가 OS별 설치 안내서로 불어나는 것을 막는다.

## 6. 테스트: 커버리지 100% 게이트

커버리지를 수집하는 구현 코드는 line·branch·function 100%를 요구한다. 이 수치는 **버그가 없다는 품질 인증**이 아니라, 실행되지 않는 분기와 예외 처리를 익명으로 남기지 않게 하는 개발 제약이다.

80~90% 임계치에서는 미달 영역이 의도한 예외인지, 실수로 놓친 코드인지 알 수 없다. 현재 수치가 임계치를 넘는 동안에는 테스트 없는 분기가 추가되어도 게이트가 통과한다. 100%는 새 구멍을 그 변경에서 즉시 드러낸다.

테스트로 의미 있게 도달할 수 없는 방어 분기는 조용히 수치를 낮추지 않고 해당 줄에 제외 이유를 명시한다. 도달하기 어려운 코드가 나오면 먼저 구조를 단순하게 바꿀 수 있는지 본다.

모든 테스트 코드에 선 커버리지를 강제하지는 않는다. 브라우저, 외부 HTTP race, shell 계약처럼 행동 경계가 핵심인 하네스는 실제 소비 경로의 성공으로 검증한다. 이는 구현 코드의 임계치를 피하는 예외와 다르다. 커버리지는 실행 여부만 말할 뿐 단언의 타당성, race 안전성, 요구사항 충족을 보장하지 않는다.

## 7. 주 데이터베이스: MongoDB

각 도메인은 자기 collection을 소유하고, 경계를 넘는 외래 키·join 대신 다른 서비스의 공개 API와 ID로 관계를 관리한다. 이런 문서 단위 모델은 관계형 DB의 관계 모델을 적극 활용하지 않으므로 MongoDB와 잘 맞는다.

원자성이 필요한 묶음 쓰기는 MongoDB transaction을 쓴다. 일시적인 write conflict의 재시도는 driver에 위임하고, 응용 코드에 고정 횟수 루프를 따로 만들지 않는다. RDB도 사용할 수 있지만 cross-domain 관계를 DB에 두면 나중에 서비스를 나눌 때 그 관계부터 풀어야 한다.

## 8. 구매: durable 상태 머신과 lease 재조정

구매는 결제·Redis claim·MongoDB 상태를 한 transaction으로 묶을 수 없다. 그래서 외부 효과보다 먼저 durable `pending` 기록을 만들고, 완료와 보상을 owner lease로 실행한다. 프로세스가 종료되면 재조정이 만료된 lease를 인수해 `completed` 또는 `cancelled`로 수렴시킨다.

요청의 `catch`에서만 보상하면 프로세스 종료 시 보상 코드가 실행되지 않고, 재시작 후 무엇을 되돌려야 하는지 알 수도 없다. Durable 상태가 이 복구 기준이다. 현재 흐름은 동기 HTTP 결과를 유지하면서 상태 머신으로 수렴할 수 있어 Restate workflow로 옮기지 않았다. 장기 인간 승인이나 다단계 provider 조율이 추가되면 재검토한다.

## 9. 로그 출력: 구조화 stdout

API와 NGINX의 활성 로그는 구조화된 한 줄로 stdout/stderr에 남긴다. 컨테이너 안의 별도 파일은 표준 수집 경로를 중복하고 교체 시 사라지므로 만들지 않는다. 검증용 Compose는 로컬 디스크를 보호하는 최소 회전만 담당한다.

로그 backend·보존 기간·검색·접근 제어는 배포 환경마다 다르다. 시드가 특정 backend를 강제하면 사용하지 않는 프로젝트도 그 이미지·설정·보안 경계를 계속 유지해야 하므로 포함하지 않았다.

## 10. 명시적으로 거부한 도구

공통 기준은 도구가 줄여 주는 비용이 학습·운영·설정 비용보다 클 때만 추가한다는 것이다.

| 도구              | 현재 도입하지 않은 이유                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Kafka             | NATS가 현재 fan-out·queue·선택적 durable messaging을 충족하며 운영 부담이 더 작다.                             |
| BullMQ            | 장기 작업의 재시도·상태·보상을 수동으로 유지하는 대신 Restate workflow를 사용한다.                             |
| OpenAPI / Swagger | 성공 흐름은 실제 요청을 보내는 curl spec으로 검증한다. 정적 카탈로그와 실제 동작의 drift를 두지 않는 선택이다. |
| Passport          | 현재 인증 흐름은 NestJS Guard로 직접 표현하는 편이 더 작고 읽기 쉽다.                                          |
| Nx / Turborepo    | 현재 workspace 규모에서 pnpm으로 충분하며 추가 task graph·cache 도구의 이득이 유지 비용보다 작다.              |
| pino              | 현재 로깅 처리량은 병목이 아니며 winston 기반 context·redaction을 다시 작성할 이유가 없다.                     |
| Service Mesh      | 현재 Compose 기반 시드에는 과하며 Kubernetes 운영으로 이동할 때 재검토한다.                                    |
