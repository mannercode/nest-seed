# tests/ — 배포 스택 대상 테스트

단위·통합 테스트는 보통 각 워크스페이스 안(`apps/api/src/__tests__`, `libs/*/src/**/__tests__`)에 살고 `pnpm run test`로 돈다([apps 문서의 테스트 절](apps.md#테스트) 참고). `tests/`에 모인 것은 주로 **배포된 스택을 밖에서 검증하는** 무거운 테스트라 폴더가 따로 있다. 다만 하네스 자체의 계약은 같은 워크스페이스 안에 둔다. `tests/api-race/contracts`는 공통 HTTP/SSE client·repository 계약을 `pnpm --filter './tests/api-race' test`로, `tests/web/contracts`는 두 Next.js BFF의 공통 보안·프런트 린트 계약을 `pnpm --filter './tests/web' test`로 실행한다. 둘 다 배포 스택이나 브라우저를 시작하지 않고 기본 `pnpm run test`에 포함된다.

한 화면의 실행 명령과 결과 위치는 [`tests/README.md`](../tests/README.md)에 있고, 테스트 파일별 검증 대상은 [테스트 파일 인벤토리](../test-inventory.md)에 있다. 루트 테스트 명령은 마지막에 통과·실패한 영역, 검증 이유, 실제 경과 시간과 실행되지 않은 검증을 요약하고 같은 내용을 `_output/test-reports/`의 Markdown 보고서에 남긴다.

## api-race — 분산 레이스 시나리오

한 프로세스 안에서 실행하는 테스트만으로는 여러 API 컨테이너가 동시에 같은 자원에 접근할 때 생기는 레이스를 재현하기 어렵다. 이런 문제는 API 컨테이너 4개를 Docker Compose로 시작하고, 외부에서 HTTP 요청을 동시에 보내야 확인할 수 있다.

각 시나리오는 별도 Node 스크립트로 작성했다. 앱 코드는 가져오지 않고 HTTP 요청으로만 시스템과 상호작용한다.

| 파일                       | 검증 대상                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `sse-fanout-race.js`       | SSE 이벤트가 모든 API 컨테이너의 클라이언트에게 빠짐없이 전달되는가                                      |
| `user-signup-race.js`      | 같은 이메일 동시 가입 → unique index로 1개만 201, 나머지는 409                                           |
| `ticket-holding-race.js`   | 같은 좌석 동시 선점 → Redis Lua script로 1개만 204, 나머지는 409                                         |
| `showtime-overlap-race.js` | 겹치는 시간대의 Restate 상영 workflow 동시 요청 → Mongo 트랜잭션·극장 guard CAS로 1개만 성공             |
| `purchase-double-spend.js` | 같은 티켓 묶음 동시 구매 → 1개만 성공, 나머지는 4xx(409/400), 결제는 1건                                 |
| `purchase-overlap-race.js` | 겹치되 다른 티켓 묶음 동시 구매(락 키가 달라 직렬화를 우회) → 원자 전이로 1개만 성공, 패자는 보상 후 4xx |
| `replica-chaos.js`         | API 컨테이너 4개 중 1개 종료 → NGINX 우회 처리로 5xx 1% 미만 유지                                        |
| `jwt-refresh-race.js`      | 같은 리프레시 토큰 동시 회전 → 정확히 1개만 200, 나머지는 동시 회전 409                                  |

각 스크립트는 요청마다 별도 `http.Agent({keepAlive:false})`를 만든다. NGINX의 `least_conn`이 실제로 여러 컨테이너로 요청을 나누도록 keep-alive 풀을 공유하지 않기 위해서다. 응답의 `x-replica-id` 헤더(정의는 [배포](deploy.md#x-replica-id-응답-헤더))로 요청이 여러 컨테이너에 분산되었는지도 확인한다. 이렇게 해서 "사실은 한 컨테이너에만 갔는데 통과한" 거짓 성공을 막는다.

```bash
pnpm run race <scenario>                               # 인자 없이 실행하면 시나리오 목록이 나온다
pnpm --filter './tests/api-race' test                  # 배포 없이 HTTP/SSE 공통 클라이언트만 검증한다
```

러너가 배포 스택을 띄우고 내리는 것까지 맡는다. 각 시나리오는 Node 내장 `node:test`의 상위 테스트 하나로 실행되어 검증할 불변식의 이름, 성공·실패, 소요 시간과 stack을 표준 형식으로 출력한다. 루트 명령은 스택 준비와 정리까지 포함한 전체 시간도 `_output/test-reports/race.md`에 남긴다. 내부 반복은 subtest로 늘리지 않고 기존 진행 로그로 남긴다. 각 시나리오의 실패 조건은 스크립트 머리 주석에 있다.
공통 HTTP 요청은 시작부터 응답 body 종료까지 30초, SSE는 응답 헤더 handshake까지 30초를 기본 기한으로 둔다. 느린 환경에서는 양의 정수 밀리초 값인 `HTTP_REQUEST_TIMEOUT_MS`와 `SSE_HANDSHAKE_TIMEOUT_MS`로 각각 덮어쓴다.

api-race와 api-benchmark 러너는 compose stack이 healthy가 된 뒤 NGINX의 Restate endpoint `http://nginx:9080`도 등록한다. 등록은 `force: false`라 같은 URI 뒤의 service manifest를 덮어쓰지 않는다. AtoZ·Stability는 시작 시 fresh Restate를 만들고 같은 prebuilt 이미지를 반복하므로 그대로 재사용한다. 수동으로 API/workflow 코드를 바꾼 뒤 다시 측정할 때는 먼저 `bash infra/reset.sh`를 실행한다. 이 명령은 개발용 Restate journal도 지운다.

## api-benchmark — 성능 비교

같은 배포 스택을 대상으로 하는 성능 측정 도구다. 하네스는 k6 스크립트이며, devcontainer에 패키지를 설치하지 않고 digest를 고정한 공식 `grafana/k6` 이미지를 `run-k6.sh`가 deploy 네트워크와 workspace에 연결해 실행한다. 아래 러너 두 개가 이 실행기를 호출한다. 실행 전제(스택 기동, 시드 데이터)와 환경 변수는 각 스크립트의 머리 주석에 있다.

| 파일                     | 측정 대상                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `run-k6.sh`              | 공식 k6 컨테이너에 deploy 네트워크·workspace·결과 파일 권한 연결          |
| `mixed-runner.sh`        | 읽기·쓰기 혼합 행렬 — 단독 케이스(`iso-*`) 대비 혼합 케이스의 간섭을 본다 |
| `harness-crud.js`        | 시나리오 10종(Mongo 읽기/쓰기, 비인덱스 정규식 스캔, health 등) 지속 부하 |
| `harness-refresh.js`     | `/users/refresh` — Redis 토큰 회전과 MongoDB 계정 상태 조회가 결합된 경로 |
| `harness-user-filter.js` | 비인덱스 부분 문자열 검색의 전체 컬렉션 스캔 비용                         |

```bash
pnpm run benchmark:api                                          # 스택 기동·시드·측정·정리까지 한 번에
SERVER_URL=http://nginx bash tests/api-benchmark/mixed-runner.sh # 떠 있는 deploy 스택 반복 측정 — 쓰기 레그는 ADMIN_ACCESS_TOKEN 필요(발급은 runner.sh의 seed_admin_and_login)
```

결과는 콘솔 한 줄 요약과 `tests/api-benchmark/_output/<scenario>-<ts>-<label>.json`으로 남고, mixed-runner는 런 내부의 시간축 추이를 담은 HTML 대시보드(`tests/api-benchmark/_output/dashboard-*.html`)도 함께 남긴다. 루트 명령의 전체 경과 시간과 측정 목적은 `_output/test-reports/benchmark-api.md`에서 본다.

수치에 절대 합격선은 없다 — 같은 머신의 이전 결과(JSON의 `label`·`serverUrl`로 짝지음)와 비교하는 회귀-비교용이다. 결과 JSON은 이런 모양이다(일부 필드 생략).

```json
{
    "label": "iso-r200",
    "scenario": "theater-read",
    "serverUrl": "http://nginx",
    "concurrency": 200,
    "durationMs": 5000,
    "totalSamples": 11615,
    "rps": 2323,
    "latencyMs": { "p50": 87, "p95": 116.99, "p99": 159.95, "max": 1239.92 },
    "statusCodes": { "200": 11615 }
}
```

읽는 순서는 다음과 같다.

1. `statusCodes`부터 본다. `0`(연결 실패)이 섞이면 측정 자체가 무효이고, 5xx가 많으면 지연 수치는 에러 경로를 잰 것이다. 쓰기 시나리오에 401이 섞이면 `ADMIN_ACCESS_TOKEN` 누락이다.
2. 혼합 케이스의 read/write RPS·p95를 단독 케이스(`iso-*`)와 견줘 간섭 정도를 본다.

## web — 브라우저 e2e와 BFF 계약

[`run-e2e.sh`](../tests/web/run-e2e.sh)가 전용 Compose project에서 `apps/api`·`apps/console`·`apps/user-app`의 production 이미지를 빌드하고 healthy 상태까지 기다린 뒤, 공식 Playwright 이미지의 일회성 컨테이너를 실행한다. 브라우저에서는 관리자 로그인과 영화·극장·사용자 관리, 사용자 가입·로그인·세션 회전 흐름을 검증한다. 개발 서버를 재사용하지 않으므로 e2e가 실제로 검사한 앱 바이너리와 실행 환경이 분명하다. PR/push CI는 재시도 없이 첫 실패를 게이트하고, 정기 실행만 한 번 재시도한다. 실패 시 trace·screenshot·JUnit·HTML report와 Compose 상태·로그는 workflow artifact로 보존한다.

앱과 runner는 Dev Container·인프라가 쓰는 기존 외부 네트워크에 붙지만 Compose project 이름은 `${COMPOSE_PROJECT_NAME}-web`으로 분리한다. 따라서 종료할 때 web 앱들만 내리고 MongoDB 같은 개발 인프라는 건드리지 않는다. API·프런트엔드는 host port를 publish하지 않고 runner가 `http://api:${API_PORT}`, `http://console:${CONSOLE_PORT}`, `http://user-app:${USER_APP_PORT}`처럼 service DNS로 접근한다. Docker socket은 runner에 전달하지 않으며 stack의 build·기동·정리는 Dev Container의 wrapper가 맡는다.

Playwright 공식 이미지는 브라우저와 OS 의존성을 제공할 뿐 프로젝트의 `@playwright/test` package를 포함하지 않는다. runner 이미지는 `tests/web/package-lock.json`으로 `npm ci`하고, e2e 소스·설정과 결과 폴더만 bind mount한다. `tests/web/package.json`의 `@playwright/test` 버전, lockfile의 직접 버전과 이미지 tag는 정확히 같게 함께 갱신한다. console·user-app은 Next.js standalone 출력만 runtime 이미지에 복사한다. 내부 HTTP로 도는 e2e에서만 `BFF_COOKIE_SECURE=false`를 주입하고, 일반 production 기본값은 secure cookie다.

같은 워크스페이스의 `contracts/bff-proxy.spec.ts`는 BFF의 Origin·Host 경계, proxy IP 경계와 refresh 재시도 쿠키 보존을 두 앱에 동일하게 적용하는 계약 테스트다. 별도 Playwright 설정을 써서 앱과 브라우저를 시작하지 않으며, 이 빠른 계약 테스트는 루트 pnpm workspace에서 실행한다.

```bash
pnpm --filter './tests/web' test # 브라우저 없는 BFF·프런트 린트 계약
pnpm run e2e                    # AtoZ에도 포함되는 browser e2e
pnpm run e2e:list               # 앱을 띄우지 않고 runner에서 테스트 이름 확인
pnpm run e2e:ui                 # 컨테이너 UI를 127.0.0.1:9323에 publish
pnpm run e2e:report             # 마지막 HTML 결과 열기
```

`e2e:ui`는 Docker host의 loopback `127.0.0.1:9323`에만 UI를 publish한다. Remote SSH에서는 remote host port forwarding 또는 로컬 터미널의 `ssh -L 9323:127.0.0.1:9323 <host>`로 전달해 연다. 일반 e2e 실행은 어떤 port도 publish하지 않는다.

## CI 반복 — test-stability

CI 워크플로는 둘이다. [test-atoz.yaml](../.github/workflows/test-atoz.yaml)은 PR·main push·수동 실행에서 전체 회귀(atoz)를 한 번 돌려 기능 회귀를 잡고, test-stability는 같은 시나리오를 누적 반복해 흔들림(간헐 실패)을 드러낸다. test-atoz는 3시간마다, test-stability는 6시간마다 정기 실행되도록 선언되어 있다. GitHub는 public fork의 scheduled workflow를 기본으로 비활성화하므로, fork 소유자가 필요할 때 Actions 화면에서 명시적으로 활성화한다. 수동 실행은 schedule 활성화 여부와 무관하다.

[test-stability.yaml](../.github/workflows/test-stability.yaml)은 행렬의 각 레그를 독립된 잡으로 실행한다. 각 분산 시나리오는 50회, libs 단위/통합 테스트는 75회, 부팅 검증은 50회를 반복한다. apps/api는 한 러너에 장시간 부하가 누적되지 않고 240분 제한 안에 끝나도록 20회씩 세 레그로 나누어 총 60회를 유지한다.

apps/api 반복은 실행별 coverage 디렉터리를 누적하지 않도록 `--coverage.enabled=false`로 수집을 끄고 반복 흔들림만 본다. 이것은 커버리지 게이트를 우회하는 경로가 아니다. `test-atoz`의 전체 `pnpm run test`가 별도로 커버리지 100% 게이트를 통과해야 하고, apps/api AtoZ는 실제 API global setup·setupFiles·teardown을 지정한 전용 config로 Vitest 명령 두 개를 동시에 돌리는 격리 하네스도 검증한다. 활성화한 coverage는 `apps/api/_output/vitest-runs/r<실행 ID>/coverage/`에 실행별로 분리되고, 활성화된 테스트 콘솔 로그는 별도 파일로 복제하지 않는다.

분산 레이스 레그는 반복을 시작하기 전 `deploy/prebuild-images.sh`로 API·NGINX 이미지를 한 번만 준비한다. API의 pnpm store는 Docker BuildKit cache로 재사용한다. 각 회차는 `DEPLOY_IMAGES_PREBUILT=true`로 `docker compose up --no-build`를 써서 같은 이미지를 재사용한다. 이렇게 해야 반복 횟수가 이미지 레지스트리 메타데이터 장애와 빌드 시간을 반복 추출하지 않고, 같은 바이너리의 안정성을 측정한다.

부팅 레그는 `infra/reset.sh`(인프라 compose 전체 재기동)를 반복한다. 레이스 코드는 한 번 통과했다고 안전하다고 보기 어렵다. 그래서 결과가 얼마나 흔들리는지 누적으로 확인한다. 반복 횟수와 timeout은 각 레그가 GitHub Actions 상한 안에서 진단 표본을 모으도록 맞춘 값이다. 실패하면 Actions 로그에서 `[Run i/N]` 마커로 실패 회차를 찾는다. 이어지는 컨테이너 로그 덤프는 `repeat.sh`가 의도적으로 남기는 진단이다.

반복 중 `tickets.spec.ts`로 표시된 NATS JetStream 파일 경합과 해결안 교정 과정은 [NATS 테스트 경합 사례 연구](../nats-jetstream-test-race.md)에 정리했다.
