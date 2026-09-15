# 코드와 문서 재검토

현재 지침은 [폴더별 문서](../../README.md#9-문서)와 `docs/reference/`에 있다. 이곳의 메모는 미결 제안이며, [과거 자료](../backup/README.md)와 함께 나중에 코드·테스트를 대조해 문서를 다시 작성하기 위한 입력이다.

## 남은 검토 자료

- [JSON·DTO 자동 변환](runtime-complexity-review.md): 유보한 변환 정책과 기존 데이터 복원 계약. [전체 런타임 검토 원문](../backup/reviews/runtime-complexity-review.md)은 반영 전 자료다.
- [reference 검토](docs-reference-review.md): 일괄 API 강제, MongoDB 설명, 테스트 분리, 타입 작성 규칙의 5개 항목.
- [삭제와 상영 생성의 경합](catalog-deletion-showtime-creation-race.md): 지원할 정합성 범위와 S3 정리 계약을 결정할 항목.
- [이전 단순화 검토](../backup/reviews/repository-simplification-review.md)·[프로젝트 전체 검토](../backup/reviews/seed-project-review.md): 반영·철회된 제안이 섞여 있으므로 당시의 “현재”·“미해결” 판정을 코드에서 다시 확인한다.

## 과한 장치를 찾는 기준

`authVersion`은 액세스 토큰의 즉시 회수를 위해 인증 요청마다 계정 상태를 확인하던 장치였다. 액세스 토큰은 5분 만료까지 유효하고 리프레시 세션만 서버에서 회수한다는 선택에 맞춰 제거했다. 이전 검토 기록의 `authVersion` 유지 판단은 현행 계약이 아니다([인증 계약](../apps.md#335-본인-자원은-me로-다룬다)). 다른 장치의 반영 전 판단은 [런타임 검토 원문](../backup/reviews/runtime-complexity-review.md)에 기록했다.

각 장치가 충족하는 실제 요구사항, 제거했을 때 잃는 보장, 더 단순한 대안과 그 대가를 확인한다. 특히 요청하지 않은 보안·호환 경로·자동 복구와, 이름이나 형식을 맞추기 위해 생긴 분기를 살핀다. 코드량이나 사용처 수만으로 제거하지 않고, 시드가 보여 주려는 예제와 유지하기로 한 공용 유틸의 목적도 함께 판단한다.

문서를 다시 쓸 때는 확인된 목적·결정·제약과 필요한 예시만 현행 문서에 반영한다. 미결 제안을 규칙으로 바꾸거나 과거 원문 전체를 덮어쓰지 않는다.
