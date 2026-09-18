# 테스트 실행과 결과

공식 실행 환경은 Dev Container다. 검증 경계와 각 시나리오의 한계는 [tests 가이드](../tests.md)를 먼저 본다. 루트 명령은 필요한 workspace 준비 단계를 포함한다.

| 명령                       | 실행 범위                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ |
| `pnpm run test`            | workspace의 단위·통합 테스트                                                   |
| `pnpm run atoz`            | 인프라 초기화, 정적 검사·build·기본 테스트, 브라우저 E2E, 다중 복제본 API 문서 |
| `pnpm run e2e`             | production build의 demo frontend와 API 연결                                    |
| `pnpm run race <scenario>` | 다중 복제본의 HTTP/SSE 경쟁 또는 복제본 종료 시나리오                          |
| `pnpm run benchmark`       | 같은 조건의 API 성능 비교                                                      |

race와 benchmark는 기본 test·AtoZ에 포함되지 않는다. AtoZ는 시작할 때 개발 인프라의 데이터를 삭제한다. 같은 API Vitest 명령을 동시에 두 번 실행하는 것은 지원하지 않는다.

한 API spec을 확인할 때는 먼저 `pnpm run pretest`로 라이브러리를 준비하고 파일 패턴을 넘긴다. 부분 실행은 전체 100% 게이트의 대상이 아니므로 coverage를 끈다. 변경 완료 검증에서는 해당 workspace의 전체 게이트를 다시 통과해야 한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

## 결과와 진단

- 단위·통합 테스트와 race 결과는 터미널에서 확인한다. race 실패에는 스택 정리 전 컨테이너·MongoDB 진단도 남는다.
- 브라우저의 trace·screenshot·HTML 결과는 `tests/web/_output/`에 있다. `pnpm run e2e:report`로 마지막 보고서를 연다.
- API 문서의 실제 응답은 `apps/api/api-docs/_output/logs/`, 실행 항목 요약은 같은 `_output/docs/summary.md`에 있다.
- benchmark는 `tests/api/benchmark/_output/<실행 시각>/`에 `report.html`과 `summary.json`을 남긴다. 측정용 극장 데이터는 DB에 남으며 `bash infra/reset.sh`로 초기화한다.

CI 반복의 실패 회차는 `[Run i/N]`에서 찾는다. API Race의 runner 진단과 같은 시각의 컨테이너 로그를 함께 본다. 실패 후 MongoDB 상태 snapshot 하나만으로 당시 원인을 확정하지 않는다.

## 보조 실행

`pnpm run race`는 시나리오 목록, `pnpm run e2e:list`는 브라우저 테스트 목록을 보여 준다. 브라우저 interactive 실행은 `pnpm run e2e:ui`를 사용한다.

Playwright 버전을 바꾸면 browser binary와 OS 의존성도 맞춰야 한다. Dev Container 시작·AtoZ는 Chromium 설치를 실행하며, 설치만 다시 할 때는 다음 명령을 쓴다.

```bash
pnpm --filter './tests/web' exec playwright install chromium
```
