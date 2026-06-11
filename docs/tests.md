# tests/ — 배포 스택 대상 테스트

단위·통합 테스트는 여기 없다 — 각 워크스페이스 안(`apps/api/src/__tests__`, `libs/*/src/**/__tests__`)에 살고 `npm test`로 돈다. tests/에 모인 것은 **배포된 스택을 밖에서 검증하는** 테스트들이라 폴더가 따로 있다. 셋 다 무겁고 외부 전제(스택 기동)가 있어 기본 `npm test`에 넣지 않는다.

## api-race — 분산 레이스 시나리오

4-replica 배포 스택에 HTTP 경쟁을 걸어 분산 가드(분산 락, 원자 전이, unique index)를 검증한다. 앱 코드는 가져오지 않고 HTTP로만 상호작용하며, 응답의 `x-replica-id` 헤더로 요청이 실제로 여러 컨테이너에 분산됐는지 확인해 거짓 성공을 막는다.

```bash
bash tests/api-race/runner.sh <scenario>   # 인자 없이 실행하면 시나리오 목록이 나온다
```

러너가 배포 스택을 띄우고 내리는 것까지 맡는다. 시나리오별 검증 대상 표는 [테스트 §6](testing.md#6-분산-테스트-복제본-간-레이스), 각 시나리오의 실패 조건은 스크립트 머리 주석에 있다. CI(test-stability)는 각 시나리오를 50회 반복한다.

## api-perf — 성능 측정

같은 스택의 처리량·지연을 재는 k6 하네스다. 수치에 절대 합격선은 없고 이전 결과와 비교하는 회귀-비교용이다 — 결과 JSON을 읽는 순서(statusCodes부터)는 [테스트 §6의 성능 측정 절](testing.md#성능-측정--tests-api-perf)에 있다.

```bash
SERVER_URL=http://localhost:3000 bash tests/api-perf/mixed-runner.sh   # 스택 기동·시드 전제는 머리 주석
```

## console-e2e — 브라우저 e2e

Playwright가 API와 콘솔을 빌드해 띄운 뒤 브라우저에서 로그인·영화 등록 흐름을 검증한다.

```bash
npm run e2e        # atoz에도 포함되어 돈다
npm run e2e:ui -w tests/console-e2e   # 로컬 디버그: 인터랙티브 실행·트레이스 뷰
```
