# JSON·DTO 변환 검토

변환 정책은 [DTO 규칙](../reference/conventions.md#2-타입은-계약에-맞춰-고른다)과 [JSON·Restate 경계](../libs.md#1-common--런타임-코드)로 정리했다. 일반 JSON 파싱은 값을 추측하지 않고, 날짜 복원은 DTO 스키마가 맡는다.

후속 DTO 변경에서는 HTTP뿐 아니라 Restate 입력·journal 단계 결과·최종 출력의 기존 JSON도 확인한다. 실행 중인 workflow의 배포 호환성은 [revision 전환](../reference/decisions.md#endpoint와-revision-전환) 제약을 따른다.

[전체 런타임 검토 원문](../backup/reviews/runtime-complexity-review.md)은 반영 전 판단을 보관한다.
