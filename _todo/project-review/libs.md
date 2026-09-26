# 라이브러리 — 추가 재검토 조건

[재사용 라이브러리 기준](../../README.md#기능코드-변경-시-주의사항)에 따라 아래 조건이 생기면 범위를 정한다. 다음 순서의 필수 작업을 뜻하지 않는다.

- Mongo index 초기화 캐시는 client+namespace만 구분한다(`crud.repository.ts:135`). 같은 collection에 다른 index 선언을 가진 저장소를 추가하면 뒤 선언은 건너뛴다. 여러 저장소의 서로 다른 선언을 지원할지와 초기화 소유권이 공개 계약으로 명확하지 않다. 이 사용법을 지원한다면 뒤 선언도 초기화하도록 cache key·소유권을 맞춰야 한다.
- JWT 경합 테스트 `jwt-auth.service.spec.ts:179`–`:187`는 barrier release가 finally에 없다. revoke/assertion이 먼저 실패하면 대기 Promise를 남길 수 있으므로 다음 테스트 수명 정리 때 finally release+settle을 권한다. 정상 동작 결함과 분리한 테스트 구조 제약이며 별도 runtime 정책은 필요 없다.

- 순수 유틸 일부 테스트가 Nest 앱 fixture를 매번 여는 비용은 있다. 현재 안정성·소유권이 명확하므로 실제 비용을 확인할 때 필요한 범위만 판단한다.
