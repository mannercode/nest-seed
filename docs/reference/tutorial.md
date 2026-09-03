# 튜토리얼 — 유스케이스에서 테스트까지

이 글은 코드를 파일 순서로 소개하지 않고, 요구사항이 외부 계약·계층·분산 보장·테스트로 변하는 사고 과정을 따라간다. 실제 구현의 세부 내용은 복사하지 않고, 각 단계에서 읽을 진입점만 연결한다.

영화 예매 시스템을 길게 풀어낸 배경은 블로그 연재 [백엔드 서비스 분석과 설계 1](https://mannercode.com/2025/04/01/backend-design-1.html)·[2](https://mannercode.com/2025/05/01/backend-design-2.html)·[3](https://mannercode.com/2025/06/01/backend-design-3.html)에 있다.

## 1. 시작은 코드가 아니라 유스케이스다

처음 할 일은 클래스나 DB 스키마를 그리는 것이 아니라 다음 두 질문에 답하는 것이다.

1. 누가 시스템을 사용하는가?
2. 그 사용자는 무엇을 완료하려는가?

"티켓 관리"처럼 행동을 숨기는 이름은 피한다. 검색, 좌석 선점, 구매, 취소처럼 사용자가 완료할 일로 나누면 그 이름이 그대로 API와 service의 언어가 된다.

중요한 비기능 조건도 이 단계에서 고정한다. 이 시드의 설계 연습은 많은 극장을 한 번에 다루고, 좌석 중복 판매를 허용하지 않는다는 조건에서 출발한다. 뒤의 API 형태와 동시성 전략은 모두 이 조건으로 타당성을 판단한다.

## 2. 유스케이스를 외부 계약으로 옮긴다

구현 전에 사용자가 볼 API 계약을 먼저 정한다. 단일 리소스의 CRUD는 일반적인 REST 경로로 표현하고, 여러 단계가 특정 업무 흐름에서만 의미가 있다면 유스케이스 namespace로 묶는다.

```text
GET  /movies/:movieId                         범용 리소스
GET  /showtime-creation/movies                상영 생성 흐름의 선택지
POST /showtime-creation/showtimes/search      긴 극장 ID 목록을 받는 조회
POST /showtime-creation/showtimes             상영 생성 접수
```

조회에 POST를 쓰는 예외는 상태 변경을 숨기기 위한 것이 아니다. 많은 ID와 복합 조건이 URL 한계를 넘을 수 있는 경우에 본문을 안전하게 전달하기 위한 선택이다. 정확한 규칙은 [REST API 설계](../apps.md#rest-api-설계)를 본다.

## 3. API를 계층에 배치한다 — SoLA

모듈이 서로를 자유롭게 호출하면 기능이 늘어날수록 순환 참조가 생긴다. `ShowtimesService`가 영화를 검증하려고 `MoviesService`를 부르고, 나중에 영화 쪽이 상영 정보를 필요로 하면 둘은 사실상 하나의 모듈이 된다.

SoLA는 같은 계층의 모듈끼리 직접 호출하지 않고, 조합을 위 계층으로 올린다. 단일 도메인으로 끝나는 요청은 Gateway가 Core를 직접 사용하지만, 영화·극장·상영·티켓을 함께 다루는 상영 생성은 Application에서 조합한다. **Application은 모든 유스케이스의 통과 계층이 아니라, 조합이 필요한 유스케이스의 계층**이다.

상영 생성의 개념적 호출 흐름은 다음과 같다.

```text
Gateway → public Application API → workflow 제출
                                      ↓
Restate endpoint → workflow → persistence transaction
                                      ├→ validator → Core 읽기
                                      └→ creator   → Core 쓰기
```

HTTP 접수 경로가 validator와 creator를 직접 부르는 구조가 아니다. Restate가 workflow를 실행하고, workflow가 persistence 경계에서 검증과 생성을 조율한다. 모듈 밖의 사용자는 [`showtime-creation/index.ts`](../../apps/api/src/services/application/showtime-creation/index.ts)에 드러난 공개 API만 사용하고 `internal/`·`worker/`의 구성을 알 필요가 없다.

컨트롤러도 feature 모듈 안이 아닌 Gateway에 둔다. 그래야 도메인 모듈이 HTTP와 이웃 모듈 둘 다에 묶이지 않아, 모놀리스에서 독립 서비스로 옮길 여지가 남는다. 다섯 계층의 정확한 책임은 [SoLA 5계층](../apps.md#sola-5계층)을 본다.

## 4. 규모가 계약을 바꾼다 — 202, workflow, 동시성

많은 극장·상영일·회차·좌석을 한 번에 다루면 상영과 티켓 생성 수는 빠르게 커진다. 예를 들어 `4,000 × 60 × 8 × 500`은 9억 건을 넘는다. 이는 현재 API 한 요청의 허용량이 아니라, 동기 요청을 기본 계약으로 두면 안 된다는 설계 사고 실험이다. 실제 구현은 한 작업의 크기도 제한한다.

그래서 상영 생성은 다음 계약을 사용한다.

- 요청은 `202 Accepted`와 `sagaId`를 받고 빠르게 끝난다.
- Restate workflow가 실행 기록·재시도·중단 후 재개를 담당한다.
- SSE는 진행을 알리지만 이벤트를 replay하는 상태 저장소가 아니다.
- 사용자는 `sagaId`로 종결 상태를 재조회할 수 있다.
- 상영·티켓·멱등 operation은 MongoDB transaction으로 함께 커밋된다.

### 동시성은 workflow와 다른 문제다

같은 workflow key의 재시도는 합칠 수 있지만, 서로 다른 `sagaId`가 같은 극장 시간을 동시에 변경하는 것은 막지 못한다. 두 transaction이 같은 예전 snapshot을 보고 모두 검증을 통과할 수 있기 때문이다.

상영 생성은 transaction에서 극장별 schedule guard를 검증보다 먼저 CAS 갱신한다. 동시 transaction은 write conflict로 재시도된 뒤 최신 상태를 다시 검증한다. 티켓 판매도 락이 아니라 “현재 판매 가능한 티켓만 판매된 상태로” 바꾸는 원자 조건부 전이가 이중 판매를 막는다.

즉 멱등성은 같은 요청의 재시도를 합치고, 동시성 제어는 다른 요청 사이의 경쟁에서 정합성을 지킨다. 둘을 같은 보장으로 취급하지 않는다.

### 모델은 관리 단위와 경계를 반영한다

좌석은 블록·행·번호라는 값으로 식별되며 별도 lifecycle을 가진 관리 대상이 아니므로 자체 ID를 두지 않는다. 반면 Ticket은 다른 도메인을 join하지 않고 자기 경계에서 조회할 수 있도록 안정적인 ID를 중복 저장한다. ID를 무조건 붙이거나 정규화를 무조건 최선으로 삼지 않고, 실제 관리 단위와 서비스 경계를 따른다.

## 5. 구현 순서 — 외부에서 안으로

DB schema부터 만들면 각 함수를 확인하는 임시 테스트가 쌓이기 쉽다. 내부 인터페이스가 바뀔 때 사용자 행동은 그대로인데도 함수 단위 테스트가 모두 깨지면, 테스트가 설계를 지키기보다 refactoring을 방해하게 된다.

이 시드에서 test unit은 함수가 아니라 **behavior**다. 사용자가 보는 요청·응답과 최종 상태를 먼저 고정하고, 그 계약을 유지한 채 구현을 아래로 내려간다.

1. 성공 흐름을 curl spec으로 먼저 적어 외부 계약을 고정한다.
2. controller stub에서 시작해 Core·Application·repository로 내려가며 실제 구현으로 바꾼다.
3. 실패 조건·경계값·transaction·멱등성은 실제 인프라를 사용하는 통합 테스트로 고정한다.
4. 분산 안전성은 다중 복제본 외부에서 보낸 race test로 검증한다.

실제 시작점은 성공 계약인 [`api-docs/showtime-creation.spec`](../../apps/api/api-docs/showtime-creation.spec)과 조건·실패 흐름인 [`showtime-creation.spec.ts`](../../apps/api/src/__tests__/application/showtime-creation.spec.ts)다. 문서에 현재 테스트 본문을 복사하지 않는다. 코드가 변하면 복사본은 즉시 낡은 예제가 되기 때문이다.

Mock은 실제 DB·broker·workflow 계약을 없애지 않는 범위에서 사용한다. Spy는 호출 관찰, 장애 주입, 동시성 barrier, 시간 제어를 위한 도구이며 “실물로 만들 수 없는 실패”에만 제한되지 않는다. 테스트 문장·자원 격리·fixture 원칙은 [apps 문서의 테스트](../apps.md#테스트)를 본다.

## 6. 직접 걸어보기 — 새 기능을 추가한다면

"영화에 리뷰 남기기"를 추가한다고 가정해 같은 판단 순서를 적용해 본다.

1. **유스케이스** — user가 리뷰를 작성·조회한다. "리뷰 관리"로 뭉개지 않는다.
2. **API** — 영화의 하위 리소스로 표현한다. 여러 단계 조합이 없으므로 별도 유스케이스 namespace는 필요 없다.
3. **계층** — 리뷰가 자기 상태를 소유하고 token subject로 작성자를 알 수 있다면 Core로 충분하다. 영화 정책과의 조합이 실제로 필요해질 때 Application을 검토한다.
4. **동기성** — 요청 안에서 끝나는 쓰기에 202·workflow를 추가하지 않는다.
5. **계약 우선** — curl spec으로 성공 흐름을 먼저 고정하고, 통합 테스트로 인가·경계·실패 흐름을 추가한다.

새 Core의 코드 골격은 가장 단순한 [`core/theaters`](../../apps/api/src/services/core/theaters/)에서 시작할 수 있지만, 모양을 복사하기 전에 새 도메인의 상태·규칙·소유권이 같은지 먼저 확인한다.

## 요약

```text
사용자와 유스케이스
    → 외부 API 계약
    → Core 직행 또는 Application 조합
    → 규모에 맞는 동기/비동기·동시성 보장
    → 실행 가능한 계약과 행동 중심 테스트
    → 구현
```

도구를 먼저 고르지 않는다. 외부 계약과 보장해야 할 실패 경계를 먼저 정하고, 그 결정을 지키는 가장 작은 구조와 도구를 선택한다.
