# 테스트 실행과 결과 확인

이 폴더에는 애플리케이션 밖에서 실행하는 계약, 브라우저, 분산 경합, 성능 측정 도구를 둔다. 앱과 라이브러리 내부의 단위·통합 테스트는 각 workspace에 있다. 상세한 검증 배경은 [`docs/tests.md`](../docs/tests.md)를 참고한다.

## 무엇을 실행하는가

| 영역                 | 검증 이유                                                            | 기본 명령                               | 결과                                  |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| `api-race/contracts` | 실제 race가 쓰는 HTTP/SSE deadline과 workflow 목록이 유지되는지 확인 | `pnpm --filter './tests/api-race' test` | 터미널 `node:test` 결과               |
| `api-race/probes`    | Restate 재시작 뒤 journal replay와 중단 step 재실행을 확인           | `pnpm run atoz`                         | AtoZ 보고서와 터미널 `node:test` 결과 |
| `web/contracts`      | 두 BFF의 proxy·refresh 보안 경계와 프런트 린트 계약 확인             | `pnpm --filter './tests/web' test`      | 터미널 Playwright 결과                |
| `web/e2e`            | 관리자·사용자의 실제 브라우저 흐름과 세션 보안 확인                  | `pnpm run e2e`                          | 실행 보고서, HTML, trace·screenshot   |
| `api-race` 시나리오  | 4개 API replica 사이의 경합·fanout·장애 복구 불변식 확인             | `pnpm run race <scenario>`              | 실행 보고서와 실패 시 컨테이너 진단   |
| `api-benchmark`      | 같은 머신의 이전 실행과 RPS·latency 비교                             | `pnpm run benchmark:api`                | 실행 보고서, JSON과 HTML dashboard    |

## 전체 명령의 범위

### `pnpm run test`

앱·라이브러리 단위/통합 테스트와 `api-race/contracts`, `web/contracts`를 실행한다. 브라우저 E2E, 실제 API race, benchmark는 실행하지 않는다. 마지막에 영역별 검증 이유와 실제 경과 시간을 요약한다.

### `pnpm run atoz`

`pnpm run test` 범위에 정적 검사, 앱 build, 브라우저 E2E와 배포 검증을 더한다. 배포 검증은 Restate를 실제 `SIGKILL` 후 같은 volume으로 재시작해 완료된 durable step은 replay되고 중단된 step만 재실행되는지도 확인한다. 실제 API race는 Stability workflow가 담당하고 benchmark는 수동 비교용이라 포함하지 않는다.

## 결과 보기

루트 명령은 성공·실패와 관계없이 `_output/test-reports/`에 마지막 Markdown 보고서를 덮어쓴다.

| 명령                       | 보고서                                  |
| -------------------------- | --------------------------------------- |
| `pnpm run test`            | `_output/test-reports/test.md`          |
| `pnpm run atoz`            | `_output/test-reports/atoz.md`          |
| `pnpm run e2e`             | `_output/test-reports/e2e.md`           |
| `pnpm run race <scenario>` | `_output/test-reports/race.md`          |
| `pnpm run benchmark:api`   | `_output/test-reports/benchmark-api.md` |

각 보고서에는 실행한 영역, 검증 이유, 정확한 명령, 준비·build·정리를 포함한 실제 경과 시간과 실행되지 않은 영역이 적힌다. AtoZ가 시작할 때 이전 `_output`을 지우므로 보고서는 계속 쌓이지 않는다. CI에서는 같은 내용을 Job Summary에 표시하고 보고서 파일도 artifact로 보관한다.

### 브라우저 E2E

```bash
pnpm run e2e:list                # 서버를 띄우지 않고 테스트 이름만 확인
pnpm run e2e:ui                  # 테스트 선택·실행·디버깅
pnpm run e2e:report              # 마지막 HTML 보고서 열기
```

실패한 테스트의 trace와 screenshot은 `tests/web/_output/test-results/`에 있고 HTML 보고서에서도 열 수 있다. GitHub AtoZ artifact는 이 `_output` 폴더를 14일 동안 보관한다.

### API race

```bash
pnpm run race                        # 시나리오 목록
pnpm run race ticket-holding-race    # 시나리오 하나 실행
```

시나리오마다 `node:test`가 검증할 불변식의 이름, 성공·실패, 소요 시간과 stack을 출력한다. Compose 기동·정리와 실패 시 컨테이너·데이터베이스 진단은 기존 runner가 담당한다.

### API benchmark

```bash
pnpm run benchmark:api
```

결과는 `tests/api-benchmark/_output/`의 집계 JSON과 시간축 HTML dashboard에 남는다. 절대 합격선은 없으며 같은 머신의 이전 결과와 비교한다.
