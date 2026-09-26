# 프로젝트 리뷰에서 남은 항목

현재 계약 안의 수정, 계약 결정이 필요한 항목, 보류를 구분한다. 기존 사용자·인증·권한·파일 TODO는 각 문서가 계속 소유한다.

## 진행 대상

### L1. P2 — ObjectId 표기와 일괄 조회의 동등성

- [ ] [CrudRepository](../libs/common/src/mongodb/crud.repository.ts)의 `getMany`·`allExist`에서 BSON ID 변환과 동일성 비교를 일치시킨다.

조건·영향: 유효한 대문자 ObjectId를 받으면 DB 조회는 성공하지만 `getMany`가 반환된 소문자 ID와 원문을 비교해 404를 던진다. `allExist`는 같은 ID의 대소문자 표기를 서로 다른 요청으로 세어 false를 반환한다. 단건 `get`과 일괄 조회의 계약이 다르다.

재현: 별도 MongoDB에 `abcdef123456abcdef123456`을 저장하고 대문자로 `get`하면 성공, `getMany`하면 404였다. 두 표기를 함께 전달한 `allExist`는 false였다. 사용한 임시 DB는 삭제했다.

최소 수정·검증: 기존 ID 변환 경계에서 표기를 정규화한 뒤 중복 제거·누락 판정을 수행한다. 기존 repository spec에 대문자, 혼합 표기 중복, 실제 누락을 추가한다. 앱의 사용 여부와 무관한 재사용 라이브러리 계약이며 새 계층·의존성은 필요 없다.

### L2. P2 — 초기화 캐시가 후속 인덱스 선언을 무시함

- [ ] [CrudRepository.onModuleInit](../libs/common/src/mongodb/crud.repository.ts)의 초기화 공유가 각 저장소의 인덱스 선언을 보존하게 한다.

조건·영향: 같은 MongoClient·collection namespace를 쓰는 두 저장소가 서로 다른 인덱스를 선언하면, 첫 초기화 Promise만 재사용한다. 두 번째 저장소도 초기화 성공으로 끝나지만 요청한 unique 제약이 없다.

재현: 첫 저장소의 `value_lookup` 뒤에 두 번째 저장소의 `email_unique`를 초기화했다. 실제 인덱스에는 후자가 없었고 동일 이메일 두 건의 삽입이 성공했다. 별도 DB에서 확인한 뒤 삭제했다.

최소 수정·검증: 기존 중복 초기화 공유의 목적을 유지하면서 선언이 다른 인덱스 생성까지 생략하지 않게 한다. 기존 repository spec에서 같은 선언의 동시 초기화, 다른 선언의 적용, 실패 후 재시도와 실제 중복 삽입 거절을 검증한다. 캐시 식별·실행 경로의 국소 수정이며 별도 인덱스 관리 계층은 필요 없다.

### L3. P2 — 정상 SSE의 데이터와 이벤트 경계를 잃음

- [ ] [HttpTestClient](../libs/testing/src/http.test-client.ts)의 SSE 파서가 데이터 줄과 이벤트 경계를 보존하게 한다.

조건·영향: 정상 SSE `data: first\ndata: second\n\n`을 받으면 `parsedMessage.data`를 매번 덮어써 `second`만 전달한다. 여러 줄 문자열이나 여러 줄 JSON을 반환하는 소비자의 테스트가 잘못된 내용을 관측한다.

재현: 로컬 HTTP 서버에서 위 이벤트를 보내 공개 `sse` 콜백이 `second`만 받는 것을 확인했다. CRLF로 나눈 두 이벤트도 종료 시 마지막 값 하나만 전달했고, `data:hello`와 `: heartbeat` 주석은 오류 콜백으로 전달했다. [SSE 규격](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)은 data 줄을 개행으로 연결하며 CRLF·LF·CR, 콜론 뒤 공백 생략, 주석을 허용한다.

최소 수정·검증: 기존 파서에서 줄·필드를 해석하고 data를 누적해 이벤트당 한 번 전달한다. 기존 HTTP client spec에서 여러 data 줄·빈 data·주석·공백 생략·줄바꿈과 TCP 청크 분할을 확인한다. 기존 LF 이벤트·UTF-8·오류 응답·수신 준비·자원 정리 검증을 유지하며 새 파서 패키지나 재접속 기능은 필요 없다.

### T1. P3 — workflow 실행 전 이벤트 횟수를 단언할 수 있음

- [ ] [상영 생성 테스트](../apps/api/src/__tests__/application/showtime-creation.spec.ts)의 “작업 제출 후 접수 완료 저장이 실패해도 같은 작업으로 재접수한다”에서 실행 완료를 기다린 뒤 이벤트 횟수를 확인한다.

조건·영향: 392~399행은 `Accepted`·`PreviouslyAccepted` 제출 응답만 기다리고 `waiting` 발행이 한 번이라고 단언한다. HTTP 접수와 workflow 실행은 독립이므로 실행 시작이 늦으면 정상 구현에서도 0회를 관측할 수 있다. teardown의 완료 대기는 이 단언 이후다.

근거: workflow·client·teardown의 호출 경로로 확인했다. 이번 전체 API suite는 통과했으며 지연을 강제한 실패 재현은 하지 않았다.

최소 수정·검증: 수집한 submission에 기존 `waitForCompletion`을 적용한 뒤 횟수 단언을 유지한다. 실행을 지연한 조건에서도 접수·완료를 구분해 검증한다. 기존 테스트 한 곳의 대기 순서 수정이며 sleep·retry·timeout 증가는 필요 없다.

### T2. P3 — 갱신 쿠키 누락을 허용하는 부정 비교

- [ ] [console 인증 테스트](../tests/web/e2e/console-auth-flow.spec.ts)의 142~~143·175~~176행과 [user-app 인증 테스트](../tests/web/e2e/user-auth-flow.spec.ts)의 139~140행에서 교체 쿠키의 존재를 먼저 단언한다.

조건·영향: `cookie?.value`가 이전 토큰과 다르다는 비교는 쿠키가 없어도 통과한다. 갱신 요청은 새 토큰으로 성공하지만 브라우저에 쿠키가 보존되지 않는 회귀를 놓칠 수 있다. 관리자 동시 요청의 후속 보호 요청도 refresh 쿠키만 누락된 상태는 검출하지 못한다.

재현: 설치된 Playwright `expect`에 undefined를 넣어 기존 부정 비교가 통과함을 확인했다. 현재 BFF의 쿠키 저장 오류를 재현한 것은 아니며 실제 E2E 18개는 통과했다.

최소 수정·검증: 기존 세 테스트에서 두 쿠키의 존재·문자열 값을 검사한 뒤 이전 값과 비교한다. 누락된 쿠키에서는 단언이 실패하고 정상 갱신에서는 통과해야 한다. 소수의 단언 추가로 충분하며 새 테스트 파일은 필요 없다.

## 결정 필요

### L4. 비 ISO 달력의 PlainDate 저장 계약

- [ ] [DateUtil.plainDateToDate](../libs/common/src/utils/date.ts)와 [Mongo 변환](../libs/common/src/mongodb/mongo.util.ts)의 지원 달력을 정하고 날짜가 조용히 바뀌는 경로를 없앤다.

재현: `Temporal.PlainDate.from('2025-01-01').withCalendar('buddhist')`를 변환하면 `2568-01-01T00:00:00.000Z`가 된다. 같은 ISO 날짜에 불교 달력 표기만 적용했는데 달력의 `year`를 Gregorian 연도로 저장한다. 공개 타입과 PlainDate 객체 입력 스키마는 이 값을 허용하지만, JSON으로 직렬화한 값을 같은 스키마로 복원하거나 UTC 하루 시작을 계산하면 실패한다.

선택지: 같은 날짜를 ISO로 정규화해 BSON Date에 저장하거나, ISO 외 달력을 명시적으로 거절한다. 추천은 실제 날짜를 ISO로 정규화하는 방식이다. BSON Date는 원래 달력 식별자를 보관하지 않으므로 식별자까지 복원할지 여부는 별도 계약이다.

최소 수정·검증: 결정한 계약을 기존 입력 스키마·DateUtil·JSON·Mongo 경계와 해당 spec·libs 가이드에 반영한다. 불교·일본 달력과 ISO 날짜의 저장·JSON 복원·UTC 하루 경계를 확인한다. 새 데이터 표현이나 필드를 추가하기 전에 호환 범위를 결정한다. 현재 앱의 사용 빈도로 결함을 보류하지 않는다.

## 보류

- [CacheService.withLockBlocking](../libs/common/src/cache/cache.service.ts): `waitMs: 10`, `pollMs: 40`에서 첫 획득 실패 후 두 번째 획득이 성공하면 40ms 이후 콜백을 실행한다. 가짜 Redis 응답으로 재현했으며 실제 Redis 지연 실험은 아니다. 엄격한 deadline인지 polling 대기 예산인지 계약을 더 명확히 할 수 있으나, 현재 취소·상호배제 훼손은 확인하지 않아 우선 수정 완료 조건에서 제외한다.
- [구매 중복 ticketIds](../apps/api/src/services/application/purchase/internal/ticket-purchase.service.ts): 같은 티켓을 중복 요청하면 결제 후 판매 건수 불일치로 거절·보상될 수 있다. 현재 판매 정합성과 보상은 유지되며, 잘못된 입력의 조기 거절 정책은 새 요구가 생길 때 검토한다.
