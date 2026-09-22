# 설계 선택과 한계

현재 선택의 이유와 교체할 때 잃거나 새로 맡게 될 책임을 정리한다. 실행 계약은 [apps](../apps.md), 공통 코드의 경계는 [libs](../libs.md)가 소유한다.

## 시드의 범위

이 시드는 단순 CRUD와 분산 실행의 예제를 함께 제공한다. 그렇다고 예매 서비스의 모든 기능·장애·보안 정책을 완성하지 않는다. 새 장치는 현재 요구사항에서 줄이는 비용이 학습·실행·유지 비용보다 클 때만 도입한다.

핵심은 API와 재사용 라이브러리다. 데모는 연결 흐름을 보여 줄 정도로 유지한다. 작은 중복을 없애려고 범용 BFF나 인증 프레임워크를 만들지 않는다. 기존 유틸은 사용처 개수만으로 삭제하지 않고 제공하는 계약과 찾기 쉬운 이름의 가치를 본다.

## NestJS와 모듈 경계

SoLA의 하향 의존·동료 모듈 참조 금지는 순환 참조를 줄이기 위한 선택이다. 단일 Core의 CRUD는 Gateway가 직접 호출하고, 협력이 있을 때만 Application이 조합한다. View는 화면 전용 읽기 소비자이므로 도메인 제공자가 화면 요구를 알 필요가 없다.

NestJS 예외·DI는 앱의 기본 도구로 사용한다. SDK 연결·실행을 common으로 모으되 DB 교체나 다른 언어로의 재작성을 자동화하려는 추상화는 만들지 않는다. 앱 Repository는 쿼리·인덱스·도메인 오류 변환을 소유한다. `TransactionContext`가 있어도 transaction 의미와 원자성 설계까지 DB 독립적이 되는 것은 아니다.

`generateUuid`는 Node의 어떤 API를 써야 하는지 매번 찾지 않고 목적대로 호출하기 위한 공통 유틸이다. 같은 이유로 유용한 기존 wrapper는 유지하지만 Node 기본 API 전부를 감싸지는 않는다. 독립 실행 스크립트는 common 빌드를 요구하지 않도록 SDK를 직접 사용한다.

DTO는 요청 검증과 응답·workflow·테스트의 JSON 복원에 같은 런타임 스키마를 재사용하기 위해 Zod를 선택했다. 클래스의 변환 데코레이터도 가능한 설계이며, Zod 사용은 이 프로젝트의 선택이다. 타입 인자만으로 런타임 변환 정보가 생기지 않으므로 변환할 경계에 스키마를 명시한다.

## MongoDB와 원자성

문서 단위 모델과 공식 driver 사용을 예제로 삼아 MongoDB를 선택했다. 도메인 사이의 관계는 서비스 공개 API로 관리한다. 같은 경계는 관계형 DB로도 설계할 수 있으며, cross-domain 외래 키·join을 쓰지 않는다는 사실이 MongoDB를 필수로 만들지는 않는다.

여러 쓰기가 함께 성공해야 하면 transaction을 사용한다. 현재 개발 topology는 Replica Set이다. MongoDB의 다중 문서 transaction은 [Replica Set과 sharded cluster](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)에서 지원되고 standalone은 지원하지 않는다.

과반수·저널 쓰기 확인에는 일시적인 복제·디스크 지연을 허용하되 무한 대기는 막는 기한을 둔다. `wtimeout`은 이미 반영된 쓰기를 취소하지 않으므로, 기한을 넘긴 결과를 성공이나 rollback으로 추측하지 않고 오류를 전달한다.

동시 요청의 무결성은 DB unique index·조건부 전이·transaction이 맡는다. transaction callback의 일시 오류 재시도는 driver에 위임한다. 상영의 검증·생성은 극장 문서 갱신을 먼저 수행해 서로 충돌하도록 하고, 재시도에서 새로운 snapshot을 읽는다. 단순히 transaction을 썼다는 사실만으로 두 요청의 “없음” 조회 후 삽입 경쟁이 해결되지는 않는다.

RDB로 옮기면 transaction·제약·조회 기능을 활용할 수 있다. 이 경우 저장소 구현뿐 아니라 동시성 제어·조회 계약도 함께 검증해야 한다. 지금 포크할 가능성만으로 두 DB 구현을 유지하지 않는다.

## Redis 락과 선점

분산 락은 중복 작업 비용을 줄일 때 사용한다. 만료 업로드 정리는 `withLock`으로 다른 복제본이 작업 중이면 건너뛴다. 기다려야 하는 소비자를 위한 `withLockBlocking`도 공통 유틸로 유지한다.

락 TTL이 만료하거나 소유 프로세스가 종료될 수 있으므로 락만으로 판매 정합성을 보장하지 않는다. 구매에는 티켓 묶음 전체를 키로 한 추가 락을 두지 않는다. `[A, B]`와 `[B, C]`처럼 일부만 겹치는 요청을 그런 키로는 직렬화할 수 없기 때문이다. Redis는 선점 소유권을, DB는 최종 판매 전이를 맡는다.

Redlock은 독립 Redis master들의 다른 topology를 전제로 한다. 현재 Redis Cluster의 단일 키 락을 Redlock과 같은 보장으로 설명하지 않는다. 필요한 DB 원자성을 유지하는 현재 구조에 별도 락 알고리즘을 추가하지 않는다.

## Core NATS와 JetStream

프로세스 내부 EventEmitter만으로 다른 API 복제본의 SSE client에 알림을 보낼 수 없어 NATS를 사용한다. Core NATS는 연결된 구독자에 대한 실시간 전달, JetStream은 소비자 중단 동안 보존할 구매 완료 이벤트를 맡는다.

진행 이벤트를 놓치면 별도 상태 조회로 확인할 수 있으므로 모든 subject에 저장·ack·재전달을 붙이지 않는다. 반면 구매 완료 알림은 늦게 처리해도 남아 있어야 하므로 durable consumer를 사용한다. 메일 같은 실제 외부 효과를 추가하면 소비자도 멱등 처리를 소유해야 한다.

Core NATS의 flush, JetStream PubAck, 소비자의 ack는 서로 다른 경계다. broker의 유한한 중복 억제 기간을 영구 exactly-once 보장으로 해석하지 않는다. DB 완료와 발행·소비의 원자성이 나뉘는 현재 계약은 at-least-once다.

Redis Pub/Sub도 실시간 전달에는 맞지만 durable 경로는 별도로 필요하다. Kafka를 추가하면 운영·학습 대상이 늘고 현재 예제에서 얻는 이점은 작다. sticky session도 작업을 실행하는 복제본과 SSE가 연결된 복제본이 다를 수 있어 메시지 통로를 대신하지 않는다.

## Restate와 외부 효과

상영 생성과 구매는 Restate workflow로 재시도·중단 후 재개를 표현한다. 두 업무에 자체 lease 실행기와 별도 복구 scheduler를 각각 만들지 않는다. workflow journal은 완료 step 결과를 재사용하고, 짧은 DB 묶음 쓰기는 MongoDB transaction으로 원자적으로 확정한다.

```text
외부 쓰기 성공 → 응답 또는 journal 기록 전 종료 → 같은 step 재실행 가능
```

따라서 `ctx.run`으로 감쌌어도 외부 효과는 멱등해야 한다. 상영 operation의 unique sagaId, 구매의 원자 완료·응답 스냅샷, 결제의 구매 ID가 이를 맡는다. workflow key는 같은 작업의 재제출을 합칠 뿐 다른 작업끼리의 좌석·시간 경쟁을 조정하지 않는다.

상영 생성은 DB commit으로 업무가 완료된다. 뒤의 SSE와 output 보관은 호출자가 상태를 알아내기 위한 수단이다. 같은 API 안의 접수 HTTP 요청과 Restate가 실행하는 workflow는 실행 시점·복제본이 다를 수 있다. 출력 보존 기간이 끝났다는 사실을 DB 생성이 취소된 것으로 해석하지 않는다.

구매 HTTP는 workflow 결과를 기다린다. broker 장애가 구매 완료 응답을 막지 않게 완료 알림은 별도 workflow로 넘긴다. 네트워크 오류를 업무상 거절로 확정하거나, 결제 결과를 모르는 상태에서 취소했다고 응답하지 않는다.

BullMQ나 JetStream consumer만으로도 작업을 실행할 수 있지만 단계 재시도·상태·보상을 직접 관리해야 한다. Temporal도 요구를 충족하지만 이 저장소에서는 별도 worker bundle·sandbox·서버 DB setup보다 API에 붙는 Restate endpoint가 작은 구성이었다. 이는 프로젝트의 선택이며 어느 도구가 항상 더 단순하다는 뜻은 아니다.

### 배포 revision

운영에서는 revision별 endpoint를 등록하고 기존 invocation이 끝날 때까지 이전 코드를 유지해야 한다. [Restate의 deployment](https://docs.restate.dev/concepts/services/)는 새 invocation과 진행 중인 실행이 사용할 코드를 구분한다.

workflow step을 삭제하거나 순서를 바꾸면 이전 journal은 이전 코드에서 끝내야 한다. 같은 endpoint에 새 코드를 덮어쓰면 재개 시 step 순서가 맞지 않을 수 있다. 새 DB 문서에서 필드를 없애는 것과 보존된 journal의 실행 코드를 교체하는 것은 별개의 전환이다.

```text
v1 실행 유지 → v2 endpoint 등록 → 신규 실행 전환 → v1 drain 확인 → v1 제거
```

개발용 force 재등록이나 테스트의 고정 NGINX URI를 운영 무중단 배포 방식으로 복사하지 않는다. 개발 reset은 journal까지 삭제하므로 보존할 실행이 없는 환경에서만 사용한다.

## 기본 로그인과 데모

액세스 권한은 짧은 JWT 만료로 제한한다. 현재 5분 동안 유효한 토큰을 발급하고 매 요청에서 계정·토큰 DB를 조회하지 않는다. 즉시 회수를 원하면 서버가 액세스 세션을 관리하는 다른 계약이 필요하므로 authVersion 같은 장치를 선제적으로 덧붙이지 않는다.

리프레시 회전과 로그아웃을 위한 Redis 상태는 기본 로그인 계약에 필요한 부분이다. 현재 해시만 원자적으로 바꾸고 기존 토큰의 재사용은 거절한다. 토큰 계보·이메일별 잠금·과거 refresh 재사용에 따른 전체 세션 폐기는 포함하지 않는다.

데모의 Route Handler는 쿠키를 API 요청으로 전달하는 앱 코드다. 화면별 API 응답 조합인 View와 역할이 다르다. 이를 common의 재사용 BFF framework로 키우지 않는다. IP 헤더·cookie 설정을 운영에 적용할 조건은 [apps](../apps.md#데모와-bff)가 소유한다.

## 검증의 강도와 의미

커버리지를 수집하는 API와 common 구현은 line·branch·function 100%를 요구한다. 임계치에 여유가 있으면 새로 추가한 미실행 분기가 기존 점수에 가려질 수 있기 때문에, 구멍을 같은 변경에서 검토하게 하려는 제약이다.

100%는 단언의 의미나 race 안전성을 증명하지 않는다. 도달하기 어려운 방어 분기는 먼저 구조를 단순하게 할 수 있는지 검토하고, 제외가 필요하면 이유를 명시한다. 수치를 채우려고 의미 없는 unit test와 운영 코드의 테스트 전용 분기를 늘리지 않는다.

API 통합 테스트는 실제 인프라를 사용한다. 외부 race는 프로세스 간 HTTP·SSE를, 브라우저는 실제 화면·쿠키·API 연결을 확인한다. 데모의 proxy unit suite를 별도로 크게 유지하지 않는다. 각 검증의 한계는 [tests](../tests.md)에 적고, 서로 대신 증명한다고 해석하지 않는다.

4개 API 복제본과 반복 CI는 의도한 검증 환경이다. Stability의 coverage 없는 반복 실행은 간헐 실패를 찾으며 필수 AtoZ의 게이트를 대신하지 않는다. 테스트 수·실행 횟수만으로 과잉을 판단하지 않고 실제로 검사하는 행동과 비용을 비교한다.

## 개발 환경과 로그

Dev Container 하나를 공식 개발 경로로 둔다. Mongo Replica Set·Redis Cluster·S3·NATS·Restate의 버전·설정 차이를 각 개발자에게 맡기지 않기 위해서다. Redis Cluster의 다중 키 제한처럼 standalone에서 드러나지 않는 계약도 개발 중 확인한다.

Node는 네이티브 Temporal을 사용하는 26 계열을 유지한다. TypeScript는 사용처별로 고정하며 legacy compiler API를 사용하는 앱·도구까지 자동으로 같은 major로 올리지 않는다. topology와 파괴적 reset은 [infra](../infra.md), 환경 주입과 DooD는 [Dev Container](../devcontainer.md)가 소유한다.

활성화된 API 로그는 ECS JSON 한 줄로 stdout/stderr에 출력한다. 컨테이너 내부의 별도 회전 파일을 중복으로 만들지 않는다. 검증 스택은 Docker 로그를 제한된 크기로 회전하고, 장기 저장·검색 backend는 실제 배포에서 선택한다. 요청·응답 본문과 query는 runtime 요청 로그에 포함하지 않는다.

## 추가하지 않은 도구

| 도구                      | 현재 선택의 이유                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| OpenAPI / Swagger         | 주요 흐름은 실행 가능한 curl 문서로 동작과 함께 검증한다. 별도 카탈로그·SDK 생성은 요구하지 않는다. |
| Passport                  | 현재 역할별 인증은 Nest Guard로 작게 표현한다.                                                      |
| Nx / Turborepo            | 현재 workspace 실행은 pnpm으로 충분하며 추가 task graph·cache가 필요하지 않다.                      |
| GraphQL                   | 홈 화면 한 응답은 View로 조합할 수 있어 별도 schema·resolver 체계를 넣지 않는다.                    |
| pino                      | 현재 로그 처리량에 교체를 요구하는 병목 근거가 없다.                                                |
| Service Mesh·관측 backend | 운영 플랫폼 선택을 시드에 선제적으로 고정하지 않는다.                                               |

이 표는 도구의 일반적인 우열이 아니라 현재 요구사항에 대한 결정이다.
