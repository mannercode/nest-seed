# tests/ — 배포 스택 대상 테스트

단위·통합 테스트는 여기 없다 — 각 워크스페이스 안(`apps/api/src/__tests__`, `libs/*/src/**/__tests__`)에 살고 `npm test`로 돈다([apps 문서의 테스트 절](apps.md#테스트) 참고). tests/에 모인 것은 **배포된 스택을 밖에서 검증하는** 테스트들이라 폴더가 따로 있다. 셋 다 무겁고 외부 전제(스택 기동)가 있어 기본 `npm test`에 넣지 않는다.

## api-race — 분산 레이스 시나리오

한 프로세스 안에서 실행하는 테스트만으로는 여러 API 컨테이너가 동시에 같은 자원에 접근할 때 생기는 레이스를 재현하기 어렵다. 이런 문제는 API 컨테이너 4개를 Docker Compose로 시작하고, 외부에서 HTTP 요청을 동시에 보내야 확인할 수 있다.

각 시나리오는 별도 Node 스크립트로 작성했다. 앱 코드는 가져오지 않고 HTTP 요청으로만 시스템과 상호작용한다.

| 파일                       | 검증 대상                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `sse-fanout-race.js`       | SSE 이벤트가 모든 API 컨테이너의 클라이언트에게 빠짐없이 전달되는가                                      |
| `user-signup-race.js`      | 같은 이메일 동시 가입 → unique index로 1개만 201, 나머지는 409                                           |
| `ticket-holding-race.js`   | 같은 좌석 동시 선점 → Redis Lua script로 1개만 204, 나머지는 409                                         |
| `showtime-overlap-race.js` | 겹치는 시간대 상영 등록 사가 동시 요청 → 분산 락으로 1개만 성공, 나머지는 실패                           |
| `purchase-double-spend.js` | 같은 티켓 묶음 동시 구매 → 1개만 성공, 나머지는 4xx(409/400), 결제는 1건                                 |
| `purchase-overlap-race.js` | 겹치되 다른 티켓 묶음 동시 구매(락 키가 달라 직렬화를 우회) → 원자 전이로 1개만 성공, 패자는 보상 후 409 |
| `replica-chaos.js`         | API 컨테이너 4개 중 1개 종료 → NGINX 우회 처리로 5xx 1% 미만 유지                                        |
| `jwt-refresh-race.js`      | 같은 리프레시 토큰 동시 회전 → 새 토큰이 동시에 유효한 경우 0개 또는 1개만                               |

각 스크립트는 요청마다 별도 `http.Agent({keepAlive:false})`를 만든다. NGINX의 `least_conn`이 실제로 여러 컨테이너로 요청을 나누도록 keep-alive 풀을 공유하지 않기 위해서다. 응답의 `x-replica-id` 헤더(정의는 [배포](deploy.md#x-replica-id-응답-헤더))로 요청이 여러 컨테이너에 분산되었는지도 확인한다. 이렇게 해서 "사실은 한 컨테이너에만 갔는데 통과한" 거짓 성공을 막는다.

```bash
bash tests/api-race/runner.sh <scenario>   # 인자 없이 실행하면 시나리오 목록이 나온다
```

러너가 배포 스택을 띄우고 내리는 것까지 맡는다. 각 시나리오의 실패 조건은 스크립트 머리 주석에 있다.

## api-perf — 성능 측정

같은 배포 스택을 대상으로 하는 성능 측정 도구다. 실행 전제(스택 기동, 시드 데이터)와 환경 변수는 각 스크립트의 머리 주석에 있다.

| 파일                     | 측정 대상                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `mixed-runner.sh`        | 읽기·쓰기 혼합 행렬 — 단독 케이스(`iso-*`) 대비 혼합 케이스의 간섭을 본다 |
| `harness-crud.js`        | 시나리오 10종(Mongo 읽기/쓰기, 비인덱스 정규식 스캔, health 등) 지속 부하 |
| `harness-refresh.js`     | `/users/refresh` — 호출당 Redis 4왕복이라 ioredis 클러스터 처리량을 잰다  |
| `harness-user-filter.js` | 비인덱스 부분 문자열 검색의 전체 컬렉션 스캔 비용                         |

```bash
SERVER_URL=http://localhost:3000 bash tests/api-perf/mixed-runner.sh
```

결과는 콘솔 한 줄 요약과 `_output/perf/<scenario>-<ts>-<label>.json`으로 남고, mixed-runner는 런 내부의 시간축 추이를 담은 HTML 대시보드(`_output/perf/dashboard-*.html`)도 함께 남긴다.

수치에 절대 합격선은 없다 — 같은 머신의 이전 결과(JSON의 `label`·`serverUrl`로 짝지음)와 비교하는 회귀-비교용이다. 읽는 순서는 다음과 같다.

1. `statusCodes`부터 본다. `0`(연결 실패)이 섞이면 측정 자체가 무효이고, 5xx가 많으면 지연 수치는 에러 경로를 잰 것이다.
2. 혼합 케이스의 read/write RPS·p95를 단독 케이스(`iso-*`)와 견줘 간섭 정도를 본다.

## console-e2e — 브라우저 e2e

Playwright가 `apps/api`와 `apps/console`을 빌드해 띄운 뒤, 브라우저에서 로그인·영화 등록 흐름을 검증한다. 개발 중 이미 서버가 떠 있으면 재사용한다(`reuseExistingServer`).

```bash
npm run e2e        # atoz에도 포함되어 돈다
npm run e2e:ui -w tests/console-e2e   # 로컬 디버그: 인터랙티브 실행·트레이스 뷰
```

## CI 반복 — test-stability

CI는 [test-stability.yaml](../.github/workflows/test-stability.yaml)이 레그 행렬 한 잡으로 각 분산 시나리오를 50회, 단위/통합 테스트를 75회, 부팅 검증을 50회 반복한다. 부팅 검증은 `infra/reset.sh`(인프라 compose 전체 재기동)의 반복이다. 레이스 코드는 한 번 통과했다고 안전하다고 보기 어렵다. 그래서 결과가 얼마나 흔들리는지 누적으로 확인한다. 반복 횟수는 GitHub Actions 작업의 6시간 상한에 맞춘 값이다 — 상한 안에서 표본을 최대로 모은다. 실패하면 Actions 로그에서 `[Run i/N]` 마커로 실패 회차를 찾는다 — 이어지는 컨테이너 로그 덤프는 `repeat.sh`가 의도적으로 남기는 진단이다.
