# 테스트 실행과 결과 확인

이 파일은 실행 명령과 산출물 위치만 안내한다. 각 계층이 필요한 이유와 보장하는 내용은 [`docs/tests.md`](../docs/tests.md)를 본다.

## 1. 범위

- `pnpm run test` — workspace의 단위·통합 테스트. 브라우저 E2E·실제 race·benchmark는 포함하지 않는다.
- `pnpm run atoz` — 정적 검사, build, 기본 테스트, 브라우저 E2E, 다중 복제본 검증을 포함한 전체 회귀.
- `pnpm run e2e` — production build의 console·user-app 브라우저 흐름.
- `pnpm run race <scenario>` — 다중 API 복제본의 경합·fan-out·장애 복구.
- `pnpm run benchmark:api` — 같은 머신의 이전 실행과 비교하는 API 성능 측정.

단일 API spec을 빠르게 돌릴 때는 전체 커버리지 게이트를 끄고 파일 패턴을 넘긴다.

```bash
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

## 2. 결과

단위·통합 테스트와 race 결과는 터미널에서 확인한다. 브라우저 실패의 trace·screenshot·HTML은 `tests/web/_output/`, benchmark JSON·dashboard는 `tests/api/benchmark/_output/`에 남는다.

## 3. 보조 명령

```bash
pnpm run e2e:list                   # 브라우저 시나리오 목록
pnpm run e2e:ui                     # interactive 브라우저 실행
pnpm run e2e:report                 # 마지막 HTML 보고서
pnpm run race                       # race 시나리오 목록
```
