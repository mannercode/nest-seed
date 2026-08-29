# 테스트 구조 검토와 운영 기준

최초 검토일: 2026-08-28
운영 명령 갱신: 2026-08-29

2026-08-29부터 저장소의 package manager 기준은 `pnpm@11.24.0`이다. API production bundle은 Rspack + `ts-loader`로, API·common·testing 런타임은 ESM으로 전환했다. Nest TypeScript suite는 TypeScript compiler 기반 Vitest로 전환했고 JavaScript 하네스는 Node 26 내장 `node:test`를 사용한다. 반복 횟수와 검증 강도는 바꾸지 않았다. 아래 운영 명령은 현재 pnpm·Vitest 기준이며, 문서 끝의 2026-08-28 npm·Jest 실행 결과는 전환 전 역사 자료로 보존한다.

## 결론

현재 가장 합리적인 구성은 다음과 같다.

- JavaScript로 된 race·저장소 계약·도구 스크립트는 Node 26 내장 `node:test`를 사용한다.
- Nest API와 공용 TypeScript 라이브러리의 단위·통합 테스트는 Vitest를 사용한다.
- 브라우저 흐름은 Playwright, 성능 비교는 k6를 유지한다.
- Vitest 외의 새 통합 리포트나 테스트 실행기는 추가하지 않는다.
- Vitest 변환은 SWC 없이 TypeScript compiler를 사용해 Nest decorator metadata를 보존한다.
- 다음 최적화 대상은 컨테이너가 필요 없는 테스트를 빠른 실행 경로로 분리하는 일이다.

`node:test`로 Nest 테스트까지 전면 교체하면 도구 하나를 지울 수는 있지만, TypeScript 변환·Nest decorator metadata·경로 별칭·coverage·테스트 생명주기를 별도로 다시 만들어야 한다. JavaScript 하네스에는 적합하지만 현재 Nest 시드의 TypeScript 실행기로는 Vitest가 더 작다.

이 저장소는 사람이 매일 직접 테스트를 고르는 방식보다 에이전트가 변경 범위에 가까운 테스트를 실행하고, 작업 경계에서 전체 검증을 수행하는 방식을 기준으로 운영한다. 사람이 드물게 확인할 때도 최종 요약과 기존 HTML 보고서만 보면 되도록 한다.

현재 전체 실행에서 확인한 결과는 다음과 같다.

- API: 36 suites, 414 tests
- `libs/common`: 42 suites, 635 tests
- `libs/testing`: 12 suites, 62 tests
- JavaScript 실행·자원 격리 helper: 23 tests
- API·common·testing과 JavaScript helper의 coverage 100% gate 통과
- Vitest 병렬 worker별 자원·결과 경로 격리와 터미널 tree 출력 적용

실행기만 교체했으며 분산 race 내부 반복, Stability 외부 반복, 3시간·6시간 주기와 각 테스트의 부하량은 줄이지 않았다.

## 이미 정리된 구조

```text
tests/
├── README.md                 # 명령, 검증 이유, 결과 위치를 한 화면에 설명
├── show-results.mjs          # pnpm test·atoz 종료 요약
├── api-race/
│   ├── contracts/            # race 하네스와 저장소 계약의 빠른 node:test
│   ├── probes/               # AtoZ의 실제 인프라 장애·복구 probe
│   ├── *-race.js             # 실제 4-replica 분산 경합 시나리오
│   ├── race-common.js
│   └── runner.sh
├── api-benchmark/            # k6 성능 비교와 결과 파일
└── web/
    ├── contracts/            # BFF·ESLint 계약
    ├── e2e/                  # 실제 브라우저 흐름
    └── playwright*.config.ts
```

이름 변경으로 다음 혼동을 줄였다.

- `api-race`는 실제 분산 경합 검증이라는 기존 의미를 유지한다.
- 예전 `api-perf`는 자동 합격 판정이 아니라 비교 측정이므로 `api-benchmark`로 명확히 했다.
- 프런트 테스트는 별도 공용 프런트 계층이 아니라 Nest seed에 딸린 Console·User app 검증이라는 현재 역할을 유지한다.
- `contracts`와 `e2e`를 구분해, 빠른 계약 테스트와 실제 브라우저 실행이 같은 것으로 보이지 않게 했다.
- benchmark도 테스트 관련 도구를 한곳에서 찾을 수 있도록 `tests/` 아래에 둔다.

분산 race의 내부 반복, Stability의 외부 반복, 3시간·6시간 주기는 줄이지 않았다. 발견까지 오래 걸리는 간헐적 경합 오류를 찾는 목적이므로 실행량은 정리 대상이 아니다.

## 전체 명령이 실제로 하는 일

| 영역                      | `pnpm test` | `pnpm run atoz` | 전용 실행                               | 결과                           |
| ------------------------- | ----------- | --------------- | --------------------------------------- | ------------------------------ |
| Nest API·공용 라이브러리  | 실행        | 실행            | workspace별 Vitest                      | tree 출력, coverage            |
| `api-race/contracts`      | 실행        | 실행            | `pnpm --filter './tests/api-race' test` | `node:test` 결과               |
| `api-race/probes`         | 미실행      | 실행            | 배포 검증 내부                          | `node:test` 결과               |
| `web/contracts`           | 실행        | 실행            | `pnpm --filter './tests/web' test`      | Playwright list 결과           |
| 실제 브라우저 E2E         | 미실행      | 실행            | `pnpm run e2e`                          | HTML, JUnit, trace, screenshot |
| 실제 API race             | 미실행      | 미실행          | `pnpm run race <scenario>`              | `node:test`, 실패 진단         |
| API benchmark             | 미실행      | 미실행          | `pnpm run benchmark:api`                | JSON, HTML dashboard           |
| 정적 검사·build·배포 검증 | 미실행      | 실행            | 각 workspace 명령                       | 터미널                         |

`pnpm test`가 성공하면 마지막에 다음을 별도 화면으로 출력한다.

- 통과한 영역
- 각 영역을 실행한 이유
- 이 명령에서 의도적으로 제외한 브라우저 E2E, 실제 race, benchmark

`pnpm run atoz`가 성공하면 정적 검사, build, 브라우저 E2E, 배포 검증까지 같은 형식으로 요약한다. 브라우저 JUnit 결과가 있으면 테스트 수와 실행 시간도 표시하고 HTML 보고서 경로를 알려준다. GitHub Actions에서는 같은 내용을 Job Summary에도 남긴다.

성공 시 단순히 `PASS` 한 줄만 보고 끝나는 것이 아니라, 무엇을 확인했고 무엇은 확인하지 않았는지를 마지막 화면에서 구분할 수 있다.

실패하면 pnpm lifecycle 특성상 성공용 종료 요약은 실행되지 않는다. 이때는 요약이 없다는 사실 자체보다, 바로 위에 출력된 첫 실패 suite와 assertion·stack을 먼저 보면 된다. E2E 실패는 trace와 screenshot을 이어서 확인한다.

요약 구현과 최신 명령은 [`tests/show-results.mjs`](tests/show-results.mjs)와 [`tests/README.md`](tests/README.md)에 있다.

## 결과 확인법

### 전체 단위·통합·계약 테스트

```bash
pnpm test
```

주로 에이전트가 기능 작업을 마무리할 때 실행한다. Vitest workspace가 suite와 test를 tree 형태로 보여 주고 coverage를 출력하며, 모든 workspace가 성공했을 때만 영역별 최종 요약이 나온다.

`pnpm test`에는 다음이 포함되지 않는다.

- 서버를 실제로 띄우는 브라우저 E2E
- 4개 API replica를 띄우는 장시간 race
- 합격선 없는 benchmark

따라서 `pnpm test` 성공을 “저장소의 모든 장시간 검증을 방금 실행했다”는 의미로 해석하면 안 된다.

### 전체 AtoZ 검증

```bash
pnpm run atoz
```

정적 검사, workspace 테스트, build, 브라우저 E2E, 실제 배포 스택 검증까지 실행한다. 배포 검증은 Restate 서버를 `SIGKILL`한 뒤 같은 volume으로 재시작해 완료 step replay와 중단 step 재실행도 확인한다. 실제 race는 Stability workflow가 담당하고 benchmark는 수동 비교 도구라 여전히 제외한다.

### 브라우저 E2E

```bash
pnpm run e2e:list       # 서버 없이 테스트 이름만 확인
pnpm run e2e            # 실제 실행
pnpm run e2e:report     # 마지막 HTML 보고서 열기
pnpm run e2e:ui         # 사람이 선택 실행·디버깅할 때만 사용
```

결과는 다음 위치에 남는다.

```text
tests/web/_output/
├── report/index.html
├── junit.xml
└── test-results/
    └── <실패한 테스트>/
        ├── trace.zip
        └── test-failed-1.png
```

확인 순서는 터미널의 실패 제목과 stack, HTML report, 실패 trace 순서가 가장 빠르다. AtoZ의 GitHub artifact는 이 폴더를 보관한다.

### 실제 API race

```bash
pnpm run race                         # 시나리오 목록
pnpm run race ticket-holding-race     # 한 시나리오 실행
```

각 파일을 `node:test`의 상위 테스트 하나로 실행하므로 터미널에서 다음을 확인할 수 있다.

- 어떤 불변식을 검증했는지 나타내는 테스트명
- 성공·실패
- 소요 시간
- 실패 stack
- 기존 회차별 진행량과 최종 부하량

Compose 기동·정리, admin 준비, 실패 시 컨테이너와 데이터 저장소 진단은 기존 runner가 담당한다. 여러 시나리오를 한 Node 프로세스에서 병렬 실행하지 않는다. `replica-chaos`가 다른 시나리오의 컨테이너를 종료할 수 있기 때문이다.

시나리오 내부 반복을 모두 subtest로 만들지도 않는다. Stability 외부 반복까지 합치면 결과 로그가 지나치게 커지고 중요한 실패가 묻힌다.

### API benchmark

```bash
pnpm run benchmark:api
```

결과는 다음 위치에 남는다.

```text
tests/api-benchmark/_output/
├── <scenario>-<timestamp>-<label>.json
└── dashboard-<timestamp>-<label>-<leg>.html
```

- 터미널: RPS, p50, p95, p99, 최대 지연, 표본 수, 상태 코드
- JSON: 같은 머신의 이전 실행과 수치 비교
- HTML dashboard: 실행 중 시간축 추이

benchmark는 환경에 따라 수치가 달라지므로 임의 latency·RPS 합격선을 만들지 않는다. 기본 테스트와 AtoZ에도 넣지 않는다. 다만 측정 대상이 예상 상태 코드를 반환했는지는 별도 계약으로 확인할 가치가 있다.

## `node:test` 적용 범위

### 유지할 범위

`node:test`는 이미 다음처럼 런타임 변환이 거의 필요 없는 영역에 잘 맞는다.

- `tests/api-race/contracts`의 JavaScript 계약 테스트
- `tests/api-race/probes`의 Restate journal 장애 복구 검증
- 실제 `tests/api-race/*-race.js` 시나리오의 실행 껍데기
- `tools/__tests__`와 API 실행 도구의 JavaScript·MJS 계약 테스트

이 영역에서 얻은 효과는 의존성 감소보다 결과 형식의 표준화다. 각 race 파일에 있던 `main().catch()`와 직접 `process.exit(1)` 처리 대신, 의미 있는 테스트명·duration·stack을 Node가 일관되게 출력한다. 실제 HTTP/SSE/DB read-back 검증과 반복량은 그대로다.

### `node:test`로 전환하지 않을 범위

Nest API, `libs/common`, `libs/testing`의 TypeScript suite는 `node:test`로 옮기지 않고 Vitest로 실행한다. `@nestjs/testing` 자체가 특정 실행기 전용이라서가 아니라 현재 저장소가 다음 기능을 테스트 실행 경로에 묶어 두었기 때문이다.

#### 1. Decorator metadata

Nest DI는 TypeScript의 legacy decorator와 `emitDecoratorMetadata` 결과를 사용한다. Node 26의 내장 TypeScript 지원은 실행 전에 지울 수 있는 타입을 제거하는 기능이지, 프로젝트의 `tsconfig.json`을 읽어 일반 TypeScript compiler처럼 변환하는 기능이 아니다.

따라서 TypeScript spec을 그대로 `node --test`에 넘기는 것만으로는 현재 Nest DI 동작을 보존할 수 없다. `tsx`를 하나 추가하는 방식도 decorator metadata를 동일하게 내보내지 않으므로 해결책이 아니다.

#### 2. `tsconfig` 경로 별칭

현재 Vitest 설정은 Vite의 ESM 해석과 workspace alias로 TypeScript 경로를 테스트 실행 시 해석한다. Node의 타입 제거 기능은 `tsconfig`의 `paths`를 런타임 import 경로로 바꾸지 않는다.

안전하게 옮기려면 별도 테스트용 compile 출력과 Node가 이해할 수 있는 모듈 해석 규칙을 설계해야 한다. 별칭 변환 도구 하나를 추가하는 것만으로 끝내면 build·test 해석 규칙이 서로 달라질 수 있다.

#### 3. Coverage 계약

현재 API와 공용 라이브러리는 테스트에서 import되지 않은 소스까지 Vitest coverage `include`에 포함하고 branches·functions·lines·statements 100%를 요구한다.

Node 26의 native test coverage는 사용할 수 있지만 현재 Vitest V8 coverage 계약과 완전히 같지 않다.

- include-all에 필요한 `--test-coverage-include`는 Node 26.7부터 제공된다. 저장소의 지원 범위는 `^26.0.0`이다.
- Node native threshold에는 현재 Vitest가 확인하는 statement 기준과 같은 항목이 없다.
- TypeScript를 미리 compile할 경우 source map과 제외 규칙이 지금과 같은 소스 파일을 가리키는지도 검증해야 한다.

coverage 숫자가 비슷하게 보인다는 이유만으로 교체하면 실제로 수집되지 않은 파일을 놓칠 수 있다. `c8`을 추가하면 일부 차이를 메울 수 있지만, 도구 최소화 목표와 반대이고 다시 별도 설정을 유지해야 한다.

#### 4. 테스트 생명주기와 진단

현재 suite는 다음을 사용한다.

- `globalSetup`·`globalTeardown`
- `setupFiles`
- 자동 mock reset·restore
- Vitest mock, spy, fake timer
- 실행별 격리된 coverage 경로
- 실패 시 컨테이너 진단 reporter
- Testcontainers와 workflow runtime 시작·종료

Node에도 hook과 mock 기능이 있지만 API와 격리 방식이 같지 않다. 이를 한꺼번에 바꾸면 업무 assertion보다 테스트 기반 시설 재작성 비중이 커진다.

### Vitest 전환에서 보존한 계약

실행기 이름만 바꾸고 검증 강도를 낮추지 않았다. 전환 결과는 다음 조건을 모두 만족한다.

1. SWC 없이 TypeScript compiler 기반 변환으로 decorator metadata와 Nest DI를 보존한다.
2. `tsconfig` 경로 별칭과 ESM 해석이 앱 build 경로와 어긋나지 않는다.
3. global setup/teardown, 실제 인프라 정리, mock·spy·fake timer를 빠짐없이 옮겼다.
4. import되지 않은 파일까지 포함한 기존 100% coverage gate를 유지한다.
5. 병렬 worker별 자원과 실행별 coverage·로그 경로를 격리하고 실패 시 컨테이너 진단을 유지한다.
6. Jest·ts-jest 설정과 의존성을 제거해 장기 이중 실행기를 남기지 않았다.
7. 기본 tree reporter로 suite·test 계층과 실패 위치를 터미널에서 바로 확인할 수 있다.

| 대상                           | 실행기      | 판단      |
| ------------------------------ | ----------- | --------- |
| JavaScript race·도구 계약      | `node:test` | 적용 완료 |
| Nest·공용 TypeScript 단위/통합 | Vitest      | 적용 완료 |
| 브라우저·BFF 계약              | Playwright  | 유지      |
| 성능 비교                      | k6          | 유지      |

참고: [Node.js TypeScript 지원](https://nodejs.org/dist/latest/docs/api/typescript.html), [Node.js test runner](https://nodejs.org/dist/latest/docs/api/test.html)

## Vitest 다음에 줄일 실제 부담: container-free fast lane

실행기 교체 다음으로 효과가 크고 위험이 낮은 후보는 `libs/common` 테스트를 인프라 의존 여부로 나누는 것이다.

현재 `libs/common`의 전역 setup은 suite 전체를 위해 MongoDB replica set, Redis, S3와 NATS를 한꺼번에 준비한다. 전환 전 파일 분류 당시 45개 spec 중 약 29개는 이 컨테이너들을 직접 사용하지 않는 순수 단위 테스트였고, 인프라를 실제로 쓰는 spec은 약 16개였다. Mongoose 공용 계층 제거 뒤 최신 실행 결과는 36 files, 536 tests이며 실제 분리 전에 분류를 다시 확인한다.

즉 빠른 유틸리티·값 객체·redaction 테스트도 통합 테스트 때문에 컨테이너 기동 비용을 같이 낸다. Saga runtime은 이 workspace에서 빠졌지만 “모든 spec이 네 인프라를 기다린다”는 구조적 문제는 그대로 남았다. Restate는 실제 Saga 경계가 필요한 `apps/api` 상영 생성 스위트에서만 켠다.

실행기 교체가 끝났으므로 다음 방향을 Vitest 설정 안에서 검토한다.

- 컨테이너 없는 `test:fast`와 인프라가 필요한 `test:integration`을 같은 Vitest 안에서 분리한다.
- `pnpm test`는 두 경로를 모두 실행하고 기존 100% coverage 계약을 유지한다.
- 에이전트는 순수 코드 수정 중 `test:fast`를 반복 실행하고, 작업 완료 전 전체 `pnpm test`를 실행한다.
- 파일 이동보다 명시적인 패턴 또는 별도 config가 더 작다면 그것을 선택한다.
- 공용 setup을 테스트마다 복제하거나 범용 fixture DSL을 새로 만들지는 않는다.
- 실제 분리 후에는 실행 시간과 설정 줄 수를 비교해 유지 가치가 없으면 되돌린다.

예상 운영 흐름은 다음과 같다. 명령 이름은 구현 시 확정한다.

```text
작은 순수 코드 변경
  → 해당 workspace의 fast 테스트
  → 관련 전체 workspace 테스트
  → 작업 경계에서 pnpm test
  → 배포 경계에서 pnpm run atoz
```

이는 사람이 매번 선택해야 하는 UI를 추가하는 개선이 아니다. 에이전트가 더 짧은 피드백 경로를 쓰되 최종 검증 범위는 줄이지 않는 개선이다.

`libs/testing/src/vitest/__tests__`는 Vitest의 reset·mock·spy·fake timer와 TypeScript decorator metadata 계약을 검증한다. 현재 12 suites, 62 tests가 통과하며 JavaScript 실행·자원 격리 helper 23 tests도 함께 통과한다.

## 후속 개선 우선순위

### 1. container-free fast lane 검증

가장 먼저 작은 변경으로 실험한다. 전체 coverage와 최종 `pnpm test` 동작은 유지하고, 에이전트의 반복 실행 시간만 줄이는 것이 목표다.

### 2. race 결과의 작은 요약 파일

필요해질 때만 시나리오명, 성공 여부, 소요 시간, 완료 반복 수를 JSON 또는 Markdown 하나로 남긴다. Stability의 Job Summary나 artifact에는 이 작은 파일만 올리고, 대량 컨테이너 로그는 실패 진단용 raw log로 유지한다.

JUnit과 Allure는 실제 소비자가 생기기 전에는 만들지 않는다. 생성만 하고 읽지 않는 결과물은 유지 비용이다.

### 3. 복잡한 브라우저 흐름의 단계 표시

긴 E2E에만 `test.step`을 사용해 준비, 비회원 결과, 로그인·데이터 생성, 개인화 검증을 HTML report에 구분한다. 모든 화면의 Page Object화나 Cucumber 도입은 하지 않는다.

### 4. benchmark 응답 무결성

RPS·latency 절대 기준은 두지 않되, 의도한 API 대신 401·500 경로를 빠르게 측정하고도 성공으로 끝나지 않도록 예상 상태 코드는 확인한다. 결과 JSON과 dashboard는 성공 여부와 무관하게 보존한다.

## 도입하지 않을 것

현재 문제를 해결하기 위해 다음 도구를 추가하지 않는다.

- Jest·ts-jest를 재도입하거나 Vitest와 장기간 함께 유지하는 이중 실행 경로
- Vitest 외의 또 다른 범용 테스트 실행기
- `tsx`·`ts-node`를 이용한 임시 Nest test 실행 경로
- `c8`을 이용한 두 번째 coverage 설정
- Allure 같은 통합 보고 제품
- Nx 같은 작업 오케스트레이터
- Cucumber와 전면 Page Object 계층
- k6 Studio, Playwright VS Code 확장 같은 사람 중심 도구의 저장소 의존성
- race를 Testcontainers suite로 전면 재작성하는 작업

테스트 운영에서 지킬 핵심은 다음 세 가지다.

1. 테스트 이름과 디렉터리에서 역할이 보이는 것
2. 전체 실행 뒤 무엇을 확인했고 제외했는지 보이는 것
3. 실행기 교체 뒤에도 기존 coverage·인프라 정리·실패 진단 강도를 낮추지 않는 것

## 2026-08-28 npm·Jest 검증 기준선(역사 자료)

Restate 전환 직후, pnpm·Vitest 전환 전에 다음 결과를 확인했다. 현재 결과와 비교하기 위한 역사 자료이며, 현행 실행은 이 테스트 수와 100% coverage 강도를 유지하거나 보강했다.

- 당시 `npm test`: 전체 workspace 성공
- Nest API: 36 suites, 414 tests, statements·branches·functions·lines 100%
- 공용 라이브러리: 42 suites, 635 tests, 네 coverage 항목 100%
- `libs/testing`: 11 suites, 61 tests
- 당시 Jest 실행 자원 격리 헬퍼: 23 tests, native coverage 100%
- API race contracts: 5 tests
- Web contracts: 12 tests
- 실제 배포: API 4 replicas, Restate endpoint 등록, API 문서 81/81 성공
- Restate 복구 probe: 완료 step 1회, 중단 step만 재실행, 결과 42 복구
- SSE fan-out: 150회 × 100 clients × 10 sagas, 4 replicas에서 모두 성공
