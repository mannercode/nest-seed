# 테스트 작성 패턴과 남은 검토

조건은 `describe`, 준비는 `beforeEach`, 실행·결과 단언은 `it`에 둔다. [개발 규칙](../../docs/reference/conventions.md#테스트는-한-행동의-결과를-검증한다)을 적용하며, 순수 입력값이나 기대값 표현만 있는 테스트까지 Nest fixture로 바꾸지 않는다.

## 수정 대상

### 조건 준비와 보조 함수의 위치

- `application/purchase.spec.ts`의 저장·알림 장애 주입, `application/showtime-creation.spec.ts`의 제출·저장 실패와 기존 상영 준비, `core/user-auth.spec.ts`·`core/admin-auth.spec.ts`의 로그인·실패 이력 준비를 해당 조건의 `describe`·`beforeEach`로 옮긴다. 호출 순서·경쟁 조건·단언은 보존한다.
- `application/booking.spec.ts`의 집계 누락·타인 선점, `application/recommendation.spec.ts`·`view/home.spec.ts`의 추천 제외 대상, `core/movies-publish.spec.ts`의 CAS 실패·공개 상태 준비도 같은 구조로 맞춘다. `core/tickets.spec.ts`의 판매 실패 조건, `core/purchase-records.spec.ts`의 구매 기록 준비와 `infrastructure/payments.spec.ts`의 저장 오류 주입도 대상이다.
- 인증 spec의 `trustPrivateProxy`·`pauseNextTokenIssue`, 상영 생성 spec의 `buildCreateDto`, 영화 에셋 spec의 `getImageUrls`는 대응하는 utils가 준비·조회 책임을 맡게 한다. `buildExpectedPage`처럼 단언 내용을 표현하는 함수는 자원 준비 함수와 구분한다.
- API의 `services/application/showtime-creation/worker/__tests__/workflow.spec.ts`는 `createFixture`·`run`·수동 workflow context 조립이 spec에 섞여 있다. 취소·실패 경계의 검증을 유지하면서 fixture와 조건 준비를 분리한다. `movie-recommender.spec.ts`의 DTO 준비도 기존 테스트 데이터 도구를 먼저 확인한다.
- common의 `base-config.service.spec.ts`·`jwt-auth.service.spec.ts`·`crud.repository.spec.ts`·`nats-pubsub.service.spec.ts`·`s3-object.service.spec.ts`에는 설정 객체·토큰·저장소 harness·대기·업로드 폼의 준비 함수가 있다. 이미 있는 fixture가 이를 소유하도록 정리한다. logger·Restate spec의 로컬 factory도 함께 확인하되, 테스트 대상 자체인 decorator metadata용 클래스까지 기계적으로 옮기지 않는다.

### 실패한 테스트의 자원 정리

- `libs/common/src/auth/__tests__/jwt-auth.service.spec.ts`의 로그아웃과 refresh 경합은 revoke 실패 시 barrier를 풀지 못한다. release와 진행 중 Promise의 종료 관찰을 `finally`에서 보장하고 최초 실패를 유지한다.
- `application/showtime-creation.spec.ts`의 submission 동시 회수는 `didBothRead`만 기다려 한 조회가 먼저 실패하면 종료를 관찰하지 못한다. 경합 Promise의 실패도 관찰하고 barrier를 항상 해제한다. `application/purchase.spec.ts`의 같은 대기 패턴도 확인한다.
- `libs/common/src/restate/__tests__/restate-endpoint.spec.ts`의 첫 사례는 서버 시작 후 assertion·HTTP/2 연결이 실패하면 shutdown에 도달하지 않는다. endpoint와 client가 실패 경로에서도 종료되게 한다.

변경한 workspace의 전체 테스트·커버리지·타입 검사를 유지한다. 구조를 맞추려고 테스트를 삭제하거나 assertion을 줄이지 않는다.

## 보류한 추가 보완 후보

- `application/showtime-creation.spec.ts`의 `정상 요청 흐름`은 같은 비싼 fixture·workflow를 4개 case에서 반복한다. saga ID·SSE 완료·상영 1개·티켓 8개를 하나의 정상 요청 case에서 모두 유지하면 3회 초기화를 줄일 수 있다. 실패나 별도 입력 사례까지 합칠 이유는 없다.
- `infrastructure/assets.spec.ts:325`–`358`은 아직 유효한 업로드를 1~2초 안에 끝내야 하는 timing 민감점이 있다. 현재 실패 재현은 하지 않았다. 변경한다면 무작정 timeout을 늘리기보다 유효 업로드 완료 후 만료 상태를 제어하는 기존 패턴을 검토할 수 있다. 실제 TTL 경과를 검증하는 별도 사례는 유지해야 한다.
- [tests/api/benchmark/crud.js](../../tests/api/benchmark/crud.js) 208행–`223`은 warmup 이후에만 지표를 넣지만 graceful-stop 구간의 완료 요청을 별도로 제외하지 않고 명목 측정 시간으로 처리량을 나눈다. 같은 조건 비교 목적에는 큰 영향이 없을 수 있으므로 결함으로 확정하지 않았다. 정밀 구간 처리량이 필요할 때는 집계 종료 경계를 정의해야 한다.
