# JSON·DTO 자동 변환의 남은 검토

이 항목은 결정을 유보했으며 기존 동작을 유지한다. 로그인과 분산 실행의 현행 계약은 [apps](../apps.md), 명시적인 MongoDB ID 조건과 BFF 공통화는 [libs](../libs.md)를 따른다. [전체 검토 원문](../backup/reviews/runtime-complexity-review.md)은 반영 전 판단을 보관한다.

## 확인한 동작

[JsonUtil.parse](../../libs/common/src/utils/json.ts)는 문자열의 모양으로 날짜를 추측하고, JSON을 직접 훑어 일부 큰 정수만 문자열로 바꾼다.

| 입력                        | 현재 결과                                      |
| --------------------------- | ---------------------------------------------- |
| `{"title":"2026-09-15"}`    | `title`이 문자열 대신 `Temporal.PlainDate`     |
| `{"n":9007199254740993}`    | `n`이 문자열                                   |
| `{"n":9223372036854775809}` | `n`이 정밀도를 잃은 숫자 `9223372036854776000` |

[사용자 요청 변환](../../apps/api/src/services/core/users/dtos/request-value.schema.ts)과 [상영 생성 DTO](../../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts)에서는 비밀번호 `true`가 `"true"`, 상영 길이 `true`가 `1`, 영화 ID `false`가 `"false"`로 스키마를 통과한다. 이는 요청 변환의 동작이며 최종 로그인이거나 생성 성공을 뜻하지는 않는다.

## 결정할 범위

- 일반 JSON 파싱과 Temporal 직렬화·복원을 별도 API로 구분할지 정한다. 현재 [Restate serde](../../libs/common/src/restate/temporal-json.serde.ts)는 Temporal 복원에 의존한다.
- 날짜는 알려진 필드에서 변환할지, 숫자는 어느 정밀도까지 어떤 타입으로 받을지 정한다.
- JSON 본문의 타입 검증과 쿼리 문자열의 숫자 변환을 구분한다. `JsonUtil.parse`가 모든 HTTP 요청 본문을 파싱하는 구조는 아니다.

기존 유틸과 저장된 workflow 데이터의 복원 계약을 확인한 뒤 변경해야 한다. 이 메모의 대안을 현재 개발 규칙으로 적용하지 않는다.
