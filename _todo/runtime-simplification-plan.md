# 단순화 작업 계획

`apps/api`와 `libs/`가 시드의 핵심이다. 나머지는 이를 실행하고 보여 주는 데 필요한 정도로 둔다. 아래는 후속 작업 제안이며, 이 문서 작성으로 구현 변경을 승인한 것은 아니다.

## 먼저 정리할 항목

1. **빈 조회 조건의 의미를 보존한다.** [QueryBuilder.addIn](../libs/common/src/mongodb/mongo.util.ts)은 빈 배열을 조건에서 빼 버린다. 다른 조건이 있으면 조회 범위가 넓어지고, 없으면 필수 필터 오류가 난다. 상영 검색 결과가 없을 때 판매량 집계에 빈 ID 목록이 전달되는 경로도 영향을 받는다. 미지정과 빈 목록을 구분하고, 빈 목록은 조회 결과 없음으로 처리한다. 기존 검색 통합테스트에서 확인한다.

2. **공통 런타임에서 테스트 실행 여부를 판단하지 않는다.** [Restate endpoint](../libs/common/src/restate/restate-endpoint.ts)의 `VITEST_POOL_ID` 분기 대신 테스트 fixture가 포트와 로거를 명시하게 한다. [MongoDB 연결](../libs/common/src/mongodb/mongo-connection.ts)의 테스트용 대기 시간 무제한 설정도 재검토한다. 연결을 공유하는 범위와 종료 책임은 유지한다.

3. **인증의 사용하지 않는 확장 지점을 줄인다.** [JWT 인증](../libs/common/src/auth/jwt-auth.service.ts)의 `EventContext`, 사용자 ID 경로 설정, 필수 비동기 `onEvent`는 현재 소비자가 필요로 하는 수준으로 줄인다. 현재 이벤트 소비자는 로그만 기록하며, 모든 소비자가 `sub`를 사용한다. JWT 만료 판정은 SDK 검증과 중복하지 않게 한다. 로그인·갱신·로그아웃, 5분 액세스 토큰, 리프레시 토큰의 원자 교체는 유지한다.

4. **구현을 따라 쓴 작은 단위테스트를 정리한다.** [로거 위임](../libs/common/src/logger/__tests__/app-logger.service.spec.ts), [인증 helper](../apps/api/src/services/core/users/internal/__tests__/user-authentication.service.spec.ts), [오류 상수](../libs/common/src/idempotency/__tests__/errors.spec.ts)부터 실제로 보호하는 동작을 확인한다. 필요한 검증은 각 workspace의 `src/__tests__` 통합테스트에서 다루고, 중복된 내부 호출·상수 비교를 없앤다. 실제 인프라 계약 검증과 복잡한 알고리즘의 단위테스트는 남긴다. 파일 이동이나 테스트 개수 감축 자체를 목표로 삼지 않는다.

5. **단건 API를 일괄 API로 강제하는 규칙을 재검토한다.** [개발 규칙](../docs/reference/conventions.md#1-서비스와-메서드-이름)의 미래 일괄 처리를 위한 `getMany`·`deleteMany` 강제 때문에 단일 ID를 배열로 감싸고 결과를 다시 꺼내는 호출이 있다. 실제 단건·다건 계약에 맞춰 메서드를 제공한다. 이름을 합치려고 인자 판별 분기를 추가하지 않는다.

## 범위를 먼저 결정할 항목

- **한 구매에 여러 상영을 허용할지.** [좌석 선점](../apps/api/src/services/core/ticket-holding/ticket-holding.service.ts)은 여러 상영의 Redis 키를 나눠 처리하고 일부 실패 시 앞선 선점을 복구한다. 시드는 한 구매에 한 상영만 허용하는 쪽을 추천한다. 다만 현재 허용되는 입력을 바꾸는 결정이므로 먼저 확정해야 한다. 단일 상영에서도 필요한 원자성과 소유권 검사는 유지한다.
- **구매와 상영에 서로 다른 복구 방식이 필요한지.** [구매](../apps/api/src/services/application/purchase/purchase.service.ts)의 자체 상태 머신·lease·재조정과 상영 생성의 Restate workflow를 함께 유지할 필요를 검토한다. 복구 흐름을 줄이더라도 Restate·JetStream 예제의 목적과 중복 요청·부분 실패 보장은 보존해야 한다. 대체 설계 없이 lease·보상·outbox를 삭제하지 않는다.

## 유보한 항목

**JSON·DTO 자동 변환**은 [기존 검토](../docs/review/runtime-complexity-review.md)에 따라 결정을 유보한다. [JsonUtil](../libs/common/src/utils/json.ts)과 [테스트 HTTP client](../libs/testing/src/http.test-client.ts)의 날짜 추측·큰 정수 변환 중복도 함께 다룬다. 일반 JSON 파싱, 필드별 변환, Restate·메시지 데이터의 Temporal 복원 계약을 구분한 뒤 변경한다. 기존 유틸을 먼저 없애지 않는다.

## 작업 경계와 검증

- 데모의 프록시·쿠키 처리는 각 Next.js 앱이 소유한다. 이를 위해 `common` 모듈이나 별도 테스트 제품을 만들지 않는다.
- 기존 공용 유틸과 외부 연동 경계는 유지한다. 사용처 수나 코드량만으로 삭제하지 않는다.
- DB 트랜잭션·고유 제약, 좌석 판매의 원자성, 구매 멱등성은 단순화와 별개로 지킨다.
- 항목별로 작은 변경을 하고 해당 통합테스트·타입 검사와 필요한 문서를 함께 확인한다. 보장이나 커버리지 기준을 낮추지 않으며 새 테스트 파일은 작성 전에 동의를 받는다.
