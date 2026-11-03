# 시드 정리

## 진행

- `apps/api/api-docs/run.sh`의 `format_endpoint`에 옛 상영일 경로용 8자리 숫자 → `:date` 분기가 남아 있다. 현재 API에는 날짜 경로가 없으므로 이 분기만 제거한다. `pnpm run lint:root`와 `pnpm run api-docs`로 확인한다.

## 보류

- 로컬 `apps/api/api-docs/_output`과 `apps/api/_output/vitest-runs`에 과거 극장 API 로그·커버리지 보고서가 남아 있다. Git과 Docker 빌드에서 제외되는 생성물이며 현재 앱 실행에는 사용되지 않으므로 소스 정리의 완료 조건에서 제외한다.
