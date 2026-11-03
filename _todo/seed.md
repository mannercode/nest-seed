# 시드 정리

## 진행

- `apps/api/api-docs/run.sh`의 `format_endpoint`에 옛 상영일 경로용 8자리 숫자 → `:date` 분기가 남아 있다. 현재 API에는 날짜 경로가 없으므로 이 분기만 제거한다. `pnpm run lint:root`와 `pnpm run api-docs`로 확인한다.

## 보류

- `libs/common/src/restate/__tests__/workflow-client.spec.ts`의 입력·결과 샘플에 `movieId`, `theaterIds`, `createdShowtimeCount`, `createdTicketCount`가 남아 있다. 실행 코드에는 극장 도메인 의존이 없으며, 기존 `libs/` 수정 제외 지시에 따라 보류한다. 수정 범위가 허용되면 샘플과 출력 스키마를 일반 작업 데이터로 바꾸고 기존 제출·결과 조회 검증은 유지한다.
- 로컬 `apps/api/api-docs/_output`과 `apps/api/_output/vitest-runs`에 과거 극장 API 로그·커버리지 보고서가 남아 있다. Git과 Docker 빌드에서 제외되는 생성물이며 현재 앱 실행에는 사용되지 않으므로 소스 정리의 완료 조건에서 제외한다.
