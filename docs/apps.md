# apps/ — 애플리케이션

`apps/api`가 이 시드의 본체다. `console`과 `user-app`은 Next.js BFF와 모노레포 연결을 보여 주는 최소 데모이며, 제품 수준의 frontend architecture를 제안하지는 않는다.

API를 읽을 때는 `src/services/`의 다섯 경계를 먼저 본다. `gateway`는 HTTP 진입점, `view`는 화면 전용 조합, `application`은 여러 도메인의 유스케이스, `core`는 도메인 상태와 규칙, `infrastructure`는 외부 시스템 연동을 담당한다. `modules/`와 `config/`는 이 코드를 실행하기 위한 배선이지 도메인 계층이 아니다.

## 1. SoLA 5계층

SoLA의 목적은 계층 숫자를 맞추는 것이 아니라 **모듈 사이의 순환 참조를 구조적으로 막는 것**이다. 일반적인 layered architecture가 위→아래 방향을 제한한다면, 이 시드는 규칙 하나를 더한다.

> 같은 계층의 모듈끼리도 직접 호출하지 않는다. 둘을 조합해야 하면 둘을 모두 부를 수 있는 위 계층에 조립 모듈을 만든다.

```text
Gateway         HTTP·인증·입력 변환
    ↓
View            화면 전용 읽기 조합
    ↓
Application     여러 Core/Infrastructure를 조합하는 유스케이스
    ↓
Core            한 도메인의 상태·규칙·저장소 소유권
    ↓
Infrastructure  결제·스토리지 같은 외부 연동
```

위 계층은 아래 계층의 공개 API를 사용할 수 있지만, 아래 계층은 Gateway와 View를 모른다. 특히 컨트롤러를 feature 모듈 안에 두지 않고 Gateway로 분리해, 도메인 모듈이 HTTP에 결합되지 않게 한다. 이 규칙은 모놀리스 안에서도 서비스 분리 가능한 경계를 미리 만든다.

이 계층 규칙은 전용 정적 규칙으로 모두 강제되지 않는다. 공개 barrel과 import 제한이 일부 경계를 보호하지만, 새 모듈의 계층과 동료 모듈 참조는 코드 리뷰에서도 확인해야 한다.

### 1.1. Application Service는 조립이 필요할 때만 만든다

Application은 모든 요청이 통과하는 의식적인 계층이 아니다. Core 하나로 끝나는 CRUD는 Gateway가 해당 Core를 직접 사용한다. 여러 Core를 조합하거나 transaction·workflow·외부 효과를 조율해야 할 때만 Application Service를 만든다.

- `core/theaters`는 단일 도메인 CRUD의 기준이다.
- `application/booking`은 예매 동선에 필요한 여러 Core를 조합한다.
- `application/showtime-creation`은 영화·극장·상영·티켓과 durable workflow를 조율한다.

조합할 것이 없는데 Application을 추가하면 경계가 아니라 통과 계층만 늘어난다.

### 1.2. View는 화면 전용 서비스 소비자다

View는 도메인 서비스가 아니다. 프런트엔드가 여러 API를 호출해 조합할 화면 응답을 백엔드 한 곳에서 만드는 소비자 계층이다. `view/user-app/home`은 추천·영화·상영·극장을 화면 DTO로 묶는다.

View는 읽기 API를 조합하고 표시 순서·개수 같은 화면 정책을 적용할 수 있다. 상태를 바꾸는 유스케이스, transaction, 도메인 규칙은 두지 않는다. Application·Core·Infrastructure가 View를 참조해서도 안 된다. 이 계층을 두는 이유와 대안은 [설계 결정 §4](reference/decisions.md#4-view-계층-화면-전용-서비스-소비자)에 있다.

## 2. 분산 협력 — MSA 준비형 모놀리스

코드는 모놀리스지만 검증 스택은 API를 여러 프로세스로 실행한다. 중요한 것은 도구 목록이 아니라 각 문제의 **최종 보장 경계**다.

| 문제                             | 선택                       | 최종 보장                         |
| -------------------------------- | -------------------------- | --------------------------------- |
| 중복 작업·불필요한 경쟁 축소     | Redis 분산 락              | 락이 아니라 DB 상태 전이·CAS      |
| 연결된 구독자에게 실시간 fan-out | Core NATS                  | 손실 시 상태 재조회               |
| 중단 후에도 이어야 하는 작업     | Restate durable workflow   | journal + 멱등한 외부 효과        |
| 나중에도 처리해야 하는 이벤트    | MongoDB outbox + JetStream | at-least-once + 소비자 멱등성     |
| 여러 시스템에 걸친 결제·보상     | durable 상태 머신 + lease  | 주기 재조정을 통한 종료 상태 수렴 |

구체적인 도구 선택 이유와 거부한 대안은 [설계 결정](reference/decisions.md)이 소유한다.

### 2.1. 분산 락 — 정합성의 마지막 보루가 아니다

락을 얻지 못하면 건너뛰어도 되는 작업과, 들어온 요청을 순서대로 처리해야 하는 작업을 구분해 non-blocking과 blocking 락을 사용한다. 만료된 업로드 정리는 한 복제본만 실행하면 되지만, 구매 요청은 동일한 티켓 묶음의 불필요한 결제·보상을 줄이기 위해 기다린다.

락은 TTL이 만료하거나 소유 프로세스가 종료될 수 있다. 따라서 이중 판매는 티켓의 원자 조건부 전이가, 상영 시간 충돌은 MongoDB transaction과 극장별 guard CAS가 막는다. 락을 정합성의 근거로 삼지 않는다.

### 2.2. 메시지 — Core NATS와 JetStream의 선을 그어 둔다

상영 생성의 SSE 진행 알림은 현재 연결된 사용자에게 빠르게 전달하면 되고 최종 상태를 다시 조회할 수 있으므로 Core NATS를 쓴다. 연결 전 이벤트를 replay하지 않고 중복도 가능하다. SSE를 최종 상태의 저장소로 취급하지 않는다.

반면 구매 완료 이벤트는 소비자가 중단된 동안에도 보존해야 하므로 MongoDB outbox와 JetStream을 쓴다. DB 갱신과 broker ack, 실제 부수 효과와 consumer ack를 한 transaction으로 묶을 수 없으므로 보장은 **at-least-once**다. 실제 메일·알림·외부 호출을 추가하는 소비자는 `purchaseRecordId`를 durable inbox unique key나 provider idempotency key로 써야 한다.

### 2.3. 구매 상태 머신과 재조정

결제 provider, Redis의 티켓 claim, MongoDB의 티켓·구매 문서는 한 transaction으로 묶을 수 없다. 구매는 외부 효과보다 먼저 durable 기록을 남기고 다음 상태로 수렴한다.

```text
pending → completing → completed
   └─→ compensating → cancelled
```

각 전이는 owner ID와 만료 시각이 있는 lease를 CAS로 획득한 복제본만 실행한다. 프로세스가 중간에 종료되면 주기 재조정이 stale 기록을 찾아 만료된 lease를 인수한다. 결국 구매는 `completed` 또는 `cancelled`로 수렴하며, 완료 이벤트 발행 실패는 이미 완료된 구매를 되돌리지 않고 별도로 재시도한다.

### 2.4. Saga 오케스트레이션 — Restate

상영 생성은 접수와 실행을 분리한다.

```text
HTTP 202 접수 → 인증 주체+멱등성 키를 sagaId에 고정
              ↓
        Restate workflow(sagaId)
              ↓
     durable 상태 발행 → MongoDB transaction으로 검증·생성
              ↓
       종결 결과 저장 + SSE 알림
```

Restate journal은 완료된 step을 재사용하고 복제본 종료 후에도 실행을 이어 간다. 그러나 외부 효과의 성공과 journal 기록은 원자적이지 않으므로 durable step은 다시 호출될 수 있다. 상영·티켓·operation을 한 MongoDB transaction으로 묶고 `sagaId`의 unique operation을 저장하는 것이 최종 멱등성 경계다.

workflow key는 **같은 `sagaId`**의 중복 제출만 합친다. 서로 다른 `sagaId`가 같은 극장 시간을 동시에 변경하는 경쟁은 막지 못한다. 따라서 transaction 안에서 극장별 guard를 먼저 CAS 갱신해 경쟁 transaction을 WriteConflict로 재시도시킨다. **durable workflow와 concurrency control은 다른 문제**다.

SSE는 사용자 경험을 위한 best-effort 진행 알림이다. 사용자가 종결 상태를 알아야 할 때는 `sagaId`로 상태 API를 재조회하고, 실제 생성 결과의 기준은 MongoDB다.

## 3. 코드 컨벤션

자동 포맷으로 해결되지 않는 프로젝트 고유의 읽기·경계 규칙만 정리한다.

### 3.1. 서비스 이름과 공개 경계

Core Service는 도메인 이름, Application Service는 조합하는 유스케이스 이름을 쓴다.

모듈 안에서는 구현 파일을 상대 경로로 가져오고, 모듈 경계 밖에서는 해당 모듈의 `index.ts`에 드러난 공개 API만 사용한다. `internal/`과 `worker/`는 기본적으로 모듈 밖에 공개하지 않는다. 예외적으로 비공개 구현을 직접 테스트해야 한다면 lint 허용 목록에 의도를 남긴다.

### 3.2. 에러 규칙

예상 가능한 도메인 실패는 모듈의 `errors.ts`에 코드·사람이 읽을 메시지·문맥 필드를 가진 객체로 정의한다. Gateway는 이 에러를 HTTP 상태로 번역한다. 문자열만 던지거나 controller에서 도메인 조건을 다시 만들지 않는다.

### 3.3. REST API 설계

경로는 행위보다 리소스를 중심으로 짓는다. 다만 여러 API 단계가 특정 유스케이스 안에서만 의미가 있다면 `booking/...`, `showtime-creation/...`처럼 namespace로 묶어 범용 리소스 API와 구분한다.

#### 3.3.1. 중복 실행 비용이 큰 POST는 멱등성 키를 요구한다

결제와 장기 비동기 작업처럼 중복 요청이 다른 부수 효과를 만드는 POST는 `Idempotency-Key`를 필수로 받는다. 키는 인증 주체·endpoint와 함께 논리 요청을 식별한다. 같은 키와 같은 본문의 재시도는 처음 결과로 수렴하고, 다른 본문은 거부한다.

키는 재시도를 합칠 뿐이지 도메인 경쟁을 없애지 않는다. 다른 키의 동시 요청은 원자 상태 전이·transaction·CAS가 따로 안전하게 만들어야 한다. 메모리 캐시나 프로세스 로컬 상태를 멱등성의 근거로 쓰지 않는다.

같은 사용자와 endpoint에서 구매 요청을 보낸다고 하면 다음처럼 구분한다.

| 키   | 본문          | 처리                                                        |
| ---- | ------------- | ----------------------------------------------------------- |
| 키 A | 본문 X        | 처음 실행하고 응답을 저장                                   |
| 키 A | 본문 X 재시도 | 저장한 최초 응답을 반환                                     |
| 키 A | 본문 Y        | 같은 키의 의미가 바뀌었으므로 `409 Conflict`                |
| 키 B | 본문 X        | 별도 요청으로 실행하며, 키 A와의 경쟁은 DB 상태 전이가 조정 |

#### 3.3.2. ID만 받는 API는 처음부터 복수형으로 둔다

조회·삭제처럼 ID만 받는 service API는 `getMany`, `deleteMany`처럼 복수형으로 만든다. 나중에 bulk 처리가 필요해져도 공개 API를 깨지 않기 위해서다. HTTP의 단일 리소스 핸들러는 ID 하나를 배열로 감싸 이 API를 사용한다.

#### 3.3.3. 오래 걸리는 작업은 접수와 결과를 분리한다

요청 안에서 끝날 수 없는 작업은 `202 Accepted`와 식별자를 먼저 반환한다. 종결 결과는 다시 조회할 수 있게 저장하고, SSE는 상태 저장소가 아니라 진행 알림으로만 사용한다.

상영 생성에서 `극장 4,000 × 날짜 60 × 하루 8회 × 좌석 500`을 가정하면 생성 대상은 9억 건을 넘는다. 이는 현재 한 요청의 허용량이 아니라, 대량 작업을 동기 HTTP 계약으로 설계하면 안 된다는 사고 실험이다.

#### 3.3.4. 긴 검색 조건은 POST를 쓸 수 있다

의미상 조회여도 대량의 ID·복합 필터가 URL 한계를 넘을 수 있으면 search 리소스에 POST를 사용한다. 이 예외는 긴 입력을 안전하게 전달하기 위한 것이며, 상태를 변경하는 의미를 숨기기 위한 것이 아니다.

#### 3.3.5. 본인 자원은 `/me`로 다룬다

사용자 본인의 자원은 URL·본문의 ID가 아니라 인증 token의 subject로 식별한다. 그런 경로는 `/me`로 드러내고, 임의 ID를 받는 경로는 admin에게만 허용한다. 두 규칙을 함께 지켜야 로그인 사용자가 ID를 바꿔 다른 사용자의 자원에 접근하는 IDOR 경로가 사라진다.

### 3.4. 데이터 비정규화

도메인은 자기 collection을 소유하고 다른 도메인의 DB를 직접 join하지 않는다. 조회 경로를 단순하게 하고 모듈 의존을 줄일 수 있다면 ID처럼 안정적인 값을 중복 저장한다. 대신 중복 값의 갱신 책임이 생기므로, 조회 단순성이 그 비용보다 클 때만 선택한다.

예를 들어 좌석은 블록·행·번호로 식별되는 값이라 별도 ID를 두지 않는다. 반면 Ticket은 자기 collection만으로 조회할 수 있도록 `movieId`, `theaterId`, `showtimeId`를 중복 저장한다. 독립적인 lifecycle이 있는 대상과 조회를 위해 복제한 값을 같은 방식으로 모델링하지 않는다.

## 4. 테스트

인덱스, transaction, race condition, 프로토콜 경계는 mock으로 재현하기 어렵다. 그래서 도메인 통합 테스트는 실제 NestJS 모듈과 MongoDB·Redis·S3·NATS·Restate를 사용하고, mock을 최소화한다. 배포 스택 전체가 필요한 race·browser·benchmark는 [tests 문서](tests.md)의 별도 계층이 담당한다.

테스트의 unit은 함수 하나가 아니라 **사용자가 관찰하는 행동**이다. 내부 함수 호출 순서보다 API 응답·DB의 최종 상태·외부 계약을 검증한다. 내부 구현을 나누거나 합쳐도 행동이 같으면 테스트는 유지되어야 한다.

spy를 금지하지는 않는다. 실제 인프라 경로는 유지하면서 호출 관찰, 장애 주입, 결정적인 동시성 barrier, 시간·환경 제어가 필요할 때 쓴다. 의존성 전체를 가짜로 바꿔 통합 계약을 사라지게 만드는 mock을 경계한다.

테스트 제목을 조건과 결과로 쓰는 프로젝트 공통 규칙은 [개발 규칙 §5](reference/conventions.md#5-테스트-문장은-조건과-결과를-이어-읽게-쓴다)가 소유한다.

### 4.1. 테스트 자원은 소유자가 드러나야 한다

동시에 실행된 테스트가 DB, bucket, Redis key, NATS stream, Restate service, coverage 산출물을 공유하지 않도록 invocation·worker·test 범위의 이름을 파생한다. teardown은 현재 실행이 소유한 자원만 지우며, 소유 범위를 증명하지 못하면 넓게 정리하는 대신 실패한다. 정확한 ID 조합·lifecycle 순서·출력 경로는 테스트 설정과 helper가 소유한다.

커버리지를 수집하는 구현 workspace는 100%를 게이트로 사용한다. 이 수치의 의미·한계·예외 원칙은 [설계 결정 §6](reference/decisions.md#6-테스트-커버리지-100-게이트)에만 정의한다.

## 5. 실행 가능한 API 문서

`apps/api/api-docs/*.spec`는 bash와 curl로 작성한 주요 성공·실패 흐름의 HTTP 계약이다. 실제 요청을 보내지 못하는 정적 endpoint 카탈로그 대신, 실행해 요청·응답 예시와 브라우징 가능한 요약을 만든다. 이 선택의 이유는 [설계 결정의 거부 도구](reference/decisions.md#10-명시적으로-거부한-도구)에 있다.

`TEST`는 사람이 읽을 설명과 기대 상태를 가진 문서 항목이고, `SETUP`은 시나리오를 만들기 위한 준비 요청이다. 두 의미를 섞어 준비 호출을 API 목록으로 부풀리지 않는다. 장기 연결인 SSE는 curl 카탈로그에 억지로 넣지 않고 상태 종결까지 대기하는 통합 테스트가 검증한다.

```bash
# 축약한 spec 예시
SETUP POST /booking/showtimes/${SHOWTIME_ID}/tickets/hold \
    -d '{ ... }'

TEST "선점한 티켓 묶음을 구매한다" \
    201 POST /purchases \
    -d '{ ... }'
```

첫 요청은 구매 조건을 만들지만 API 문서 항목은 아니다. 설명과 기대 상태가 있는 두 번째 요청만 실행 결과에 계약으로 기록된다.

요청은 spec에, `TEST`의 실제 응답 본문은 상세 로그에 남긴다. 준비용 `SETUP`은 문서 항목에 포함하지 않는다. 실행 명령은 [README](../README.md#3-api-레퍼런스)가 소유한다.
