# 테스트 파일 인벤토리

이 문서는 저장소의 테스트를 **파일 단위**로 찾기 위한 색인이다. 테스트를 왜, 어떻게 실행하는지에 대한 설명은 [tests 문서](docs/tests.md)를, 실행 명령과 결과 위치만 빠르게 확인하려면 [`tests/README.md`](tests/README.md)를 본다.

## 범위와 분류

- `*.spec.ts`, `*.test.{js,cjs,mjs,sh}`처럼 테스트 케이스를 직접 선언하는 파일은 현재 105개다.
- 실행 가능한 curl 문서 `apps/api/api-docs/*.spec`, 분산 race 시나리오, Restate probe와 k6 benchmark는 이름 규칙이 달라 별도 절에 기록한다.
- fixture, mock, 공통 helper는 테스트 케이스가 없으므로 파일별 테스트 목록에서는 제외하고 주요 실행 지원 파일만 마지막 절에 정리한다.
- `apps/console`과 `apps/user-app`에는 colocated 테스트 파일이 없다. 두 앱의 계약과 브라우저 흐름은 `tests/web`에서 검증한다.

## 평가 기준과 결론

파일별 판정은 현재 구현을 유지한다는 전제에서 다음 뜻으로 사용한다.

| 판정        | 의미                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| `유지`      | 실패가 독립적인 동작·보안·정합성 회귀를 뜻하고 현재 검증 방법도 적절하다.                     |
| `보완`      | 검증 목적은 필요하지만 작은 fixture·국소 mock만으로 더 결정적으로 만들 수 있다.               |
| `축소`      | 일부 가치는 있으나 다른 계층과 겹치거나 설정 문자열을 과도하게 복제하므로 범위를 줄여야 한다. |
| `제거 후보` | 독립적인 실패 신호가 거의 없고 구현·문서의 현재 값을 한 번 더 복사하는 수준이다.              |

시드 적합성은 다음처럼 구분한다.

| 시드   | 의미                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| `핵심` | 포크 후에도 같은 기반 기술을 쓰는 동안 남겨야 하는 재사용 가능한 안전장치다.             |
| `예제` | 영화 예매 예제 코드와 함께 있어야 하지만 새 도메인으로 교체할 때 같이 바뀌거나 사라진다. |
| `선택` | 특정 개발 도구, CI 비용 정책이나 운영 편의 기능을 채택할 때만 필요하다.                  |

각 파일의 목적 바로 다음 줄에 판정을 적었다. 별도 지적이 없는 `유지`는 목적 문장 자체가 유지 근거이며, 의미 없는 중복이나 방법상 문제가 발견되지 않았다는 뜻이다. `보완`과 `축소`는 문제와 바꿀 방법을 같은 줄에 적었다.

파일 단위 판정 집계는 다음과 같다. `configuration-contract.test.mjs`는 유효한 정책 검사도 일부 포함하지만 응집된 테스트 대상이 없고 실제 build·lint·배포 검증과 과도하게 겹쳐 파일 전체를 제거 후보로 분류했다.

| 범위                              | 유지 | 보완 | 축소 | 제거 후보 |
| --------------------------------- | ---: | ---: | ---: | --------: |
| 표준 테스트 105개                 |   90 |    8 |    6 |         1 |
| API 문서·race·benchmark·배포 24개 |   15 |    9 |    0 |         0 |

전체적으로 단위·통합·브라우저·분산 race의 계층은 잘 나뉘어 있다. API 통합 테스트와 API 문서가 같은 endpoint를 호출하는 것, workflow 단위 테스트와 multi-replica race가 같은 불변식을 보는 것은 실행 경계가 달라 의도된 중복이다. 정리 효과가 큰 곳은 다음 다섯 군데다.

1. `configuration-contract.test.mjs`는 삭제한다. Standard Schema 전수 검사, image digest, loopback binding처럼 계속 강제할 정책이 있다면 각각 이름과 책임이 분명한 전용 lint로 다시 만든다.
2. 실행 가능한 API 문서는 성공 응답뿐 아니라 소비자가 만날 400·401·404·409 응답과 오류 body를 보여주는 문서다. API 통합 테스트와 endpoint가 겹쳐도 공개 예시의 목적이 다르므로 83건을 유지한다.
3. 시간 테스트는 무조건 줄이지 않는다. 외부 인프라의 실제 TTL·retry가 검증 대상이면 real clock을 유지하고, 중복 대기나 이미 만료된 fixture로 같은 분기를 만들 수 있는 경우만 줄인다. 최근 기본 테스트 1분 19.6초 중 API가 47.1초, common이 20.8초지만 실행 시간만을 위해 테스트 경계를 약화하지 않는다.
4. Vitest 명령·race 파일 목록·lint 규칙을 문자열로 다시 검사하는 계약은 실제 실행 테스트나 하나의 machine-readable manifest로 통합한다.
5. 테스트 이름·이메일처럼 시간 의미가 없는 고유값에서는 `Date.now()`를 제거한다. Node 테스트는 `randomUUID()`, race와 k6는 이미 제공하는 CSPRNG helper를 사용한다. k6의 워밍업 종료 판정도 wall clock 대신 실행기의 scenario 진행률을 사용한다.

### 시간 의존 테스트 원칙

- MongoDB·Redis·NATS·S3·Restate를 사용하는 통합 테스트에서는 Vitest fake timer와 전역 system time 변경을 사용하지 않는다. driver의 heartbeat, timeout, retry와 서버 시계는 테스트 프로세스의 가상 시간과 함께 움직이지 않는다.
- 대기는 기존 fixture나 공개 메서드만으로 같은 상태를 더 간단히 만들 수 있을 때만 없앤다. 테스트를 위해 프로덕션 메서드 인자나 DI provider는 추가하지 않는다.
- 메시지 도착 같은 양의 eventual assertion은 polling이나 완료 신호를 쓴다. “메시지가 오지 않음” 같은 음의 assertion은 관찰할 완료 사건이 없으므로 짧고 상한이 있는 real wait를 허용한다.

Node.js 26은 `Temporal`을 기본 제공하지만 `Date`를 제거하지 않는다. 이 저장소는 용도에 따라 다음처럼 구분한다.

| 용도                                        | API                                            | 판단                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 애플리케이션의 현재 시각·도메인 timestamp   | `DateUtil.now()`                               | 애플리케이션은 이 wrapper를 사용한다. 내부에서 `Temporal.Now.instant()`을 호출하고 저장·전송 경계에 맞춰 밀리초 정밀도로 맞춘다. |
| timeout·경과 시간·단일 프로세스 deadline    | `performance.now()`                            | system clock 변경의 영향을 받지 않아야 하므로 `Date.now()`를 쓰지 않는다.                                                        |
| k6 워밍업·측정 구간 경계                    | `exec.scenario.progress`                       | 전체 scenario 중 워밍업 비율을 계산하면 된다. wall clock도 epoch timestamp도 필요하지 않다.                                      |
| 미래·과거 시각 fixture                      | `DateUtil.add()` 또는 `Temporal.Instant.add()` | Node.js 테스트와 race에서는 `Temporal`로 계산한다. MongoDB에 넣을 때만 마지막에 `DateUtil.toDate()`로 변환한다.                  |
| MongoDB BSON Date·JWT·AWS SDK 등 외부 경계  | `Date` 또는 epoch milliseconds                 | 상대 API가 `Temporal`을 직접 받지 않는 경계에서만 변환해 사용한다.                                                               |
| 테스트·race·benchmark의 고유 문자열         | `randomUUID()` 또는 `secureRandomHex()`        | 시간 의미가 없으므로 `Date.now()`를 쓰지 않는다. Node와 k6 각각의 CSPRNG로 의도를 명확히 한다.                                   |
| `DateUtil.now()`의 독립적인 wall-clock 대조 | `performance.timeOrigin + performance.now()`   | `Temporal.Now`와 독립된 epoch millisecond 대조값을 만들 수 있으므로 테스트에서도 `Date.now()`를 유지할 이유가 없다.              |
| k6 결과의 ISO timestamp·파일명              | `Date.prototype.toISOString()`                 | k6 2.2.0에는 `Temporal`이 없다. 날짜 계산에는 쓰지 않고, 결과를 사람이 읽는 ISO 문자열로 직렬화하는 runtime 경계에서만 쓴다.     |

현재 raw `Date.now()`는 17개 파일에 38번 있다. 모두 제거 대상으로 분류한다. 고유값은 Web E2E 3개, race 시나리오·probe 4개, race 공통 helper 1개와 k6 harness 3개에서 난수로 바꾼다. Node.js deadline 4개는 `performance.now()`, 미래 상영 시각 3개는 `Temporal`, MongoDB용 과거 fixture 1개는 `DateUtil.add()` 후 `DateUtil.toDate()`, `DateUtil` 테스트 1개는 `performance.timeOrigin + performance.now()`를 사용한다. 한 파일이 둘 이상의 용도를 포함할 수 있다.

k6의 [`measurementStart()`](tests/api-benchmark/perf-common.js)는 제거하고 세 harness의 측정 조건을 [`k6/execution`](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/)의 `exec.scenario.progress >= warmupMs / (warmupMs + durationMs)`로 바꾼다. 현재 devcontainer가 설치하는 k6 2.2.0에는 `Temporal`과 `performance`가 없지만, scenario 진행률은 setup 종료 후 0부터 시작하므로 이 용도에 wall clock이 필요 없다. `new Date().toISOString()`은 k6 결과 timestamp와 파일명을 직렬화하는 호환 경계로만 남긴다.

현재 파일별 판단은 다음과 같다.

| 파일                          |       현재 대기 | 판단                                                                                                                                                                            |
| ----------------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwt-auth.service.spec.ts`    |         4초 × 2 | 대기만 제거한다. 두 오류 분기는 별도 `it`으로 유지하고, 각 테스트가 이미 만료된 JWT fixture로 자기 메서드를 검증한다.                                                           |
| `ticket-holding.spec.ts`      |       1.5초 × 2 | 유지. 만료 조건을 `beforeEach`에서 만들고 빈 조회와 다른 고객의 선점 성공을 각각 읽히는 `it`으로 검증한다. 두 검증은 순서가 있는 흐름이 아니므로 `beforeAll`로 공유하지 않는다. |
| `assets.spec.ts`              | 1~2.5초 여러 번 | S3 만료 대기는 유지한다. 서로 다른 만료 결과는 별도 `it`으로 두고, cron 실행 뒤의 1초 대기만 공개 메서드를 직접 `await`해서 없앤다.                                             |
| `cache.service.spec.ts`       |   1.5초 여러 번 | 유지. Redis 서버 TTL 자체가 검증 대상이며 polling으로 바꿔도 더 빨라지지 않는다.                                                                                                |
| `nats-pubsub.service.spec.ts` |        50~200ms | 유지. 도착은 이미 polling하고 있으며 남은 대기는 미수신을 관찰하는 상한이다.                                                                                                    |
| logger 테스트 2개             |         30~50ms | 유지. 총 130ms를 없애려고 `performance.now()` 제어 코드를 추가할 실익이 없다.                                                                                                   |
| `purchase-records.spec.ts`    |            50ms | 유지. 테스트 전용 생성 시각 인자나 Mongo 직접 수정보다 현재 방식이 작고 실제 정렬 경계에 가깝다.                                                                                |
| `showtime-creation.spec.ts`   |           5.1초 | 유지. Restate의 실제 5초 경계를 넘어야 완료 응답 유실 뒤 durable retry를 재현한다.                                                                                              |

### `configuration-contract.test.mjs` 18개 항목 상세

이 파일은 [설정 계약 테스트](tools/__tests__/configuration-contract.test.mjs)라는 한 이름 아래 서로 성격이 다른 검증이 섞여 있다. 아래 표는 파일을 삭제했을 때 사라지는 검사를 보여 준다. `유지`로 적힌 항목도 이 파일을 유지한다는 뜻이 아니라, 해당 정책이 필요하다면 별도 lint로 옮길 가치가 있다는 뜻이다.

| 테스트 항목                                | 판단      | 이유와 정리 방향                                                                                                                                   |
| ------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| package·설치 안전 정책                     | 제거 후보 | `package.json` script 문자열과 pnpm 설정의 현재 값을 다시 적는다. 실제 명령 실행과 pnpm 자체 검증이 실패 신호를 낸다.                              |
| 공통 Nest Oxlint baseline                  | 제거 후보 | lint를 실제로 실행하는데 도구 버전·규칙 값·script 철자를 다시 검사한다. 필요한 규칙의 효과는 위반 fixture 테스트로 검증한다.                       |
| devcontainer 재현 설치·cache 정책          | 축소      | feature digest와 frozen install 정책은 남길 수 있다. 개인 mount, 과거 script·npm 인자 부재, Dockerfile layer 순서는 기능 계약이 아니므로 제거한다. |
| API benchmark 공식 k6 runner               | 유지      | 상시 설치 회귀와 가변 image를 막는 실행 경계·공급망 계약이다. 실제 `run-k6.sh version` 실행과 함께 둔다.                                           |
| web e2e 공식 Playwright runner             | 유지      | package·lock·image 버전 일치와 digest, Docker socket 비전달을 강제한다. 앱 기동·정리는 실제 e2e 실행으로 확인한다.                                 |
| API image cache·production workspace       | 축소      | production artifact가 실행되고 dev dependency가 빠졌는지를 검증한다. cache mount와 과거 image 이름 부재 같은 Dockerfile 문자열은 제거한다.         |
| backend ESM·Vitest metadata 변환           | 축소      | 실제 TypeScript config 해석과 decorator metadata 변환은 남긴다. alias 목록, package `files`, test script 철자 snapshot은 제거한다.                 |
| 상대 import의 runtime 확장자               | 제거 후보 | NodeNext typecheck와 실제 build가 이미 검증하는 컴파일 계약이다. 동일 소스를 별도 AST로 전수 검사할 필요가 없다.                                   |
| API body·query의 Standard Schema           | 유지      | 모든 controller를 AST로 훑어 schema 누락을 잡는 독립적인 요청 검증·보안 불변식이다.                                                                |
| Nest Rspack ESM·loader 변환                | 유지      | 설정 함수에 입력을 주고 최종 loader·ESM 결과를 확인하므로 단순 파일 문자열 검사가 아니다.                                                          |
| 배포 port의 loopback binding               | 보완      | 외부 노출 방지라는 보안 계약은 필요하다. 원문 regex 대신 `docker compose config`의 유효 published address를 검사한다.                              |
| S3 internal-only·health                    | 축소      | published port 부재와 유효 healthcheck만 Compose 결과에서 확인한다. backend 종류와 과거 환경변수 부재는 제거한다.                                  |
| container image digest pin                 | 유지      | mutable tag 회귀를 막는 공급망·재현성 안전장치이며 일반 build 성공만으로는 보장되지 않는다.                                                        |
| 구조화 stdout·Docker log 한도              | 보완      | 운영 안전 계약은 남기되 service 개수와 원문 문자열 대신 Compose·NGINX의 유효 설정을 검사한다.                                                      |
| Restate durable volume                     | 축소      | 영속 volume mount는 핵심이다. 고정 node 이름과 health URL의 현재 값까지 묶어 검사하지 않는다.                                                      |
| GitHub Action pin·schedule guard·진단 보존 | 보완      | 공급망·fork 비용·실패 진단 계약은 필요하다. YAML을 파싱해 의미를 검증하고 경로·문자열 snapshot은 최소화한다.                                       |
| Stability 반복 횟수·bootup 명령            | 제거 후보 | 75·20·50 같은 현재 비용 정책을 복사할 뿐 제품 회귀를 잡지 못한다. workflow 자체를 단일 진실 원천으로 둔다.                                         |
| Stability 진단의 Compose 범위              | 보완      | 다른 project를 건드리지 않는 격리 계약은 필요하다. regex 출현 횟수 대신 fake `docker`로 실행 동작을 검증하고 shell 테스트로 옮긴다.                |

## 루트 명령과 포함 범위

| 명령                       | 포함 범위                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm run test`            | `libs/testing`, `libs/common`, API race 계약, Web 계약, tunnel 정책, Vitest 자원 helper, `apps/api` 테스트 |
| `pnpm run atoz`            | `pnpm run test` 범위에 설정 계약, 정적 검사, 앱 build, 브라우저 E2E, API 문서와 배포 검증을 추가           |
| `pnpm run e2e`             | production 앱 이미지와 공식 Playwright runner로 실행하는 `tests/web/e2e` Chromium 테스트                   |
| `pnpm run race <scenario>` | 선택한 4-replica 분산 race 시나리오                                                                        |
| `pnpm run benchmark:api`   | k6 API 부하 측정; 절대 합격선이 없는 비교 측정                                                             |

## 표준 테스트 파일 105개

### `apps/api` — 48개

#### 테스트 실행·격리와 API 문서 로그

- [`api-docs/redaction.test.sh`](apps/api/api-docs/redaction.test.sh) — API 문서 실행 로그에서 인증 헤더, 쿠키, 토큰, 비밀번호와 서명 값을 가리는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/shared-test-mongo-connection.test.cjs`](apps/api/scripts/__tests__/shared-test-mongo-connection.test.cjs) — 파일 수명의 native Mongo client와 database를 공유하고 개별 테스트가 직접 닫지 않는 계약을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/vitest-command-contract.test.cjs`](apps/api/scripts/__tests__/vitest-command-contract.test.cjs) — 일반·AtoZ·Stability Vitest 명령, coverage 위치와 setup 실패 후 정리 계약을 검사한다.
  **판정: 축소 · 시드: 선택.** 실제 병렬 실행 테스트와 겹치는 명령 문자열 검사는 빼고, setup 실패 시 정리되는 동작만 남기는 편이 낫다.
- [`scripts/__tests__/vitest-invocation-isolation.test.cjs`](apps/api/scripts/__tests__/vitest-invocation-isolation.test.cjs) — 실제 Vitest 두 프로세스를 동시에 실행해 Mongo, S3, Redis, JetStream과 출력 디렉터리가 run별로 격리되는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`scripts/__tests__/vitest-teardown-contract.test.cjs`](apps/api/scripts/__tests__/vitest-teardown-contract.test.cjs) — 실제 teardown이 현재 run의 Mongo, S3, Redis와 JetStream 자원만 선택하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### API 모듈과 통합 흐름

- [`src/__tests__/app.module.spec.ts`](apps/api/src/__tests__/app.module.spec.ts) — 실제 `AppModule` 그래프가 테스트용 `PROJECT_ID`로 모든 의존성을 생성하는지 확인한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/health.spec.ts`](apps/api/src/__tests__/health.spec.ts) — `GET /health`의 통합 상태 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/vitest-resource-isolation.spec.ts`](apps/api/src/__tests__/vitest-resource-isolation.spec.ts) — run/worker/test namespace와 병렬 teardown의 Mongo, S3, Redis, JetStream 격리를 실제 인프라에서 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/application/booking.spec.ts`](apps/api/src/__tests__/application/booking.spec.ts) — 영화·극장·상영 조회, 티켓 조회와 좌석 선점으로 이어지는 고객 예매 흐름을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/purchase.spec.ts`](apps/api/src/__tests__/application/purchase.spec.ts) — 티켓 구매, 멱등성, 원자 상태 전이, 내부 실패와 보상 경로를 검증한다.
  **판정: 보완 · 시드: 예제.** legacy 결제의 11분 전 fixture는 `DateUtil.add({ minutes: -11 })`로 계산하고 MongoDB 경계에서만 `DateUtil.toDate()`로 변환해 `Date.now()`를 제거한다.
- [`src/__tests__/application/purchase-events.spec.ts`](apps/api/src/__tests__/application/purchase-events.spec.ts) — 구매 이벤트 발행·구독과 알림 서비스 lifecycle을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/recommendation.spec.ts`](apps/api/src/__tests__/application/recommendation.spec.ts) — 로그인 사용자와 게스트의 영화 추천 결과를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/application/showtime-creation.spec.ts`](apps/api/src/__tests__/application/showtime-creation.spec.ts) — 상영 생성용 조회, 검색, SSE 상태 이벤트, Restate workflow와 트랜잭션 실패 복구를 검증한다.
  **판정: 유지 · 시드: 예제.** 5.1초 대기는 Restate의 실제 5초 경계를 넘어 완료 응답 유실과 durable retry를 재현하므로 fake timer로 바꾸지 않는다.
- [`src/__tests__/core/admin-auth.spec.ts`](apps/api/src/__tests__/core/admin-auth.spec.ts) — 관리자 로그인, 현재 사용자, refresh와 logout API를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/admin-management.spec.ts`](apps/api/src/__tests__/core/admin-management.spec.ts) — root의 관리자 생성·삭제, Basic Auth 경계와 관리자 본인 수정을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies.spec.ts`](apps/api/src/__tests__/core/movies.spec.ts) — 영화 CRUD, 목록과 이미지 조회 계약을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies-assets.spec.ts`](apps/api/src/__tests__/core/movies-assets.spec.ts) — 영화 에셋 추가·완료·삭제와 영화 삭제 시 에셋 정리를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/movies-publish.spec.ts`](apps/api/src/__tests__/core/movies-publish.spec.ts) — 필수 정보가 갖춰진 영화의 발행과 유효성 실패를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/purchase-records.spec.ts`](apps/api/src/__tests__/core/purchase-records.spec.ts) — 구매 기록 생성·사용자 조회와 durable purchase 상태를 검증한다.
  **판정: 유지 · 시드: 예제.** 50ms 대기는 Mongo fixture에 시간 주입 경로를 추가하는 것보다 작고, 정렬에 필요한 서로 다른 실제 생성 시각을 검증한다.
- [`src/__tests__/core/showtimes.spec.ts`](apps/api/src/__tests__/core/showtimes.spec.ts) — 상영 일괄 생성과 ID·시간·영화·극장·날짜 검색을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/theaters.spec.ts`](apps/api/src/__tests__/core/theaters.spec.ts) — 극장 CRUD와 목록 조회를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/ticket-holding.spec.ts`](apps/api/src/__tests__/core/ticket-holding.spec.ts) — 좌석 선점, 기존 선점 처리, 선점 조회와 구매 claim을 검증한다.
  **판정: 유지 · 시드: 예제.** Redis TTL 만료 조건을 `beforeEach`에서 두 번 만들더라도 빈 조회와 다른 고객의 선점 성공을 별도 `it`으로 유지한다. 두 검증은 순서를 가진 하나의 흐름이 아니므로 `beforeAll` 공유 대상이 아니다.
- [`src/__tests__/core/tickets.spec.ts`](apps/api/src/__tests__/core/tickets.spec.ts) — 티켓 생성·검색·판매 원자 전이와 매출 집계를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/user-auth.spec.ts`](apps/api/src/__tests__/core/user-auth.spec.ts) — 사용자 로그인, 내 정보, 계정 수정·삭제, 구매 목록, refresh, logout과 logout-all을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/users.spec.ts`](apps/api/src/__tests__/core/users.spec.ts) — 사용자 CRUD, 인가 경계와 페이지 목록을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/core/watch-records.spec.ts`](apps/api/src/__tests__/core/watch-records.spec.ts) — 시청 기록 생성과 페이지 검색을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/infrastructure/assets.spec.ts`](apps/api/src/__tests__/infrastructure/assets.spec.ts) — 업로드 URL 생성·만료, 완료 확인·확정, 조회·삭제와 만료 업로드 정리를 검증한다.
  **판정: 축소 · 시드: 핵심.** S3 presigned URL과 서로 다른 만료 결과의 독립된 테스트는 유지한다. cron callback 뒤 1초 sleep만 `cleanupExpiredUploads()`를 직접 await해 없앤다.
- [`src/__tests__/infrastructure/payments.spec.ts`](apps/api/src/__tests__/infrastructure/payments.spec.ts) — 결제 생성·취소와 구매별 조회를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/__tests__/view/home.spec.ts`](apps/api/src/__tests__/view/home.spec.ts) — 사용자 홈의 가까운 상영과 구성 결과를 검증한다.
  **판정: 유지 · 시드: 예제.**

#### 구성·도메인 단위 테스트

- [`src/config/__tests__/app-config.service.spec.ts`](apps/api/src/config/__tests__/app-config.service.spec.ts) — 애플리케이션 환경변수 스키마와 파생 설정을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/config/__tests__/connections.spec.ts`](apps/api/src/config/__tests__/connections.spec.ts) — 소유 Mongo client만 module destroy에서 닫고 공유 client는 보존하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/config/__tests__/mongo-driver-options.spec.ts`](apps/api/src/config/__tests__/mongo-driver-options.spec.ts) — 애플리케이션 수명과 테스트 파일 수명별 Mongo pool·write concern 옵션을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/modules/health/__tests__/restate.health-indicator.spec.ts`](apps/api/src/modules/health/__tests__/restate.health-indicator.spec.ts) — Restate ingress health의 성공, HTTP 오류와 요청 실패 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/booking/__tests__/booking-utils.spec.ts`](apps/api/src/services/application/booking/__tests__/booking-utils.spec.ts) — 예매 화면에 표시할 상영 정보 생성·정렬을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/recommendation/domain/__tests__/movie-recommender.spec.ts`](apps/api/src/services/application/recommendation/domain/__tests__/movie-recommender.spec.ts) — 시청 이력 기반 영화 추천 순위와 fallback을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/showtime-creation/dtos/__tests__/schemas.spec.ts`](apps/api/src/services/application/showtime-creation/dtos/__tests__/schemas.spec.ts) — 상영 생성·검색 요청 스키마의 변환과 유효성 경계를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/application/showtime-creation/worker/__tests__/restate-endpoint.service.spec.ts`](apps/api/src/services/application/showtime-creation/worker/__tests__/restate-endpoint.service.spec.ts) — Restate HTTP/2 endpoint 시작·종료, 강제 session 정리와 로그 매핑을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/restate-workflow-client.service.spec.ts`](apps/api/src/services/application/showtime-creation/worker/__tests__/restate-workflow-client.service.spec.ts) — workflow 제출·완료 대기, timeout·retry와 ingress 오류 전달을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/temporal-json.serde.spec.ts`](apps/api/src/services/application/showtime-creation/worker/__tests__/temporal-json.serde.spec.ts) — Restate wire/journal에서 Temporal 값과 빈 payload의 직렬화 왕복을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts`](apps/api/src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts) — 상영 생성 Restate workflow의 durable step, 상태 이벤트, 충돌·취소·재시도·terminal error 분류를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/admins/dtos/__tests__/schemas.spec.ts`](apps/api/src/services/core/admins/dtos/__tests__/schemas.spec.ts) — 관리자 요청 DTO 스키마를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/admins/internal/__tests__/admin-authentication.service.spec.ts`](apps/api/src/services/core/admins/internal/__tests__/admin-authentication.service.spec.ts) — 관리자 인증 payload가 현재 계정 상태와 일치하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/theaters/models/__tests__/seatmap.spec.ts`](apps/api/src/services/core/theaters/models/__tests__/seatmap.spec.ts) — 좌석 수 계산과 전체 좌석 펼치기를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/__tests__/users-pagination.spec.ts`](apps/api/src/services/core/users/__tests__/users-pagination.spec.ts) — 사용자 목록의 안정적인 pagination과 필터를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/__tests__/users-write-concern-recovery.spec.ts`](apps/api/src/services/core/users/__tests__/users-write-concern-recovery.spec.ts) — 사용자 생성 write concern 불확실성 뒤 실제 저장 결과를 재조회해 복구하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/dtos/__tests__/schemas.spec.ts`](apps/api/src/services/core/users/dtos/__tests__/schemas.spec.ts) — 사용자 요청 DTO 스키마를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/core/users/internal/__tests__/user-authentication.service.spec.ts`](apps/api/src/services/core/users/internal/__tests__/user-authentication.service.spec.ts) — 비밀번호 hash·검증, credential 조회와 인증 payload 활성 상태를 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`src/services/gateway/pipes/__tests__/request-validation.pipe.spec.ts`](apps/api/src/services/gateway/pipes/__tests__/request-validation.pipe.spec.ts) — body·배열·중첩 요청의 Standard Schema 검증과 오류 응답을 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `libs/common` — 37개

#### 인증·캐시·설정

- [`src/auth/__tests__/guards.spec.ts`](libs/common/src/auth/__tests__/guards.spec.ts) — Bearer, Basic, 복합·optional 인증 guard의 헤더 파싱과 오류 경계를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/auth/__tests__/jwt-auth.service.spec.ts`](libs/common/src/auth/__tests__/jwt-auth.service.spec.ts) — access/refresh 발급, 원자 refresh 회전, 폐기, 전체 로그아웃과 보안 이벤트를 검증한다.
  **판정: 보완 · 시드: 핵심.** 전역 시간을 바꾸지 않고 각 만료 분기가 `expiresIn: '-1s'`인 유효한 refresh token fixture를 사용하면 별도 `it`을 합치지 않고도 8초 대기와 프로덕션 변경을 모두 피할 수 있다.
- [`src/cache/__tests__/cache.service.spec.ts`](libs/common/src/cache/__tests__/cache.service.spec.ts) — Redis cache set/delete/script, lock·blocking lock, 복구와 namespace 격리를 검증한다.
  **판정: 유지 · 시드: 핵심.** Redis 서버의 TTL과 lock 소유권 만료가 검증 대상이므로 real sleep을 유지한다. polling은 만료 시점을 앞당기지 못하고 코드만 늘린다.
- [`src/config/__tests__/base-config.service.spec.ts`](libs/common/src/config/__tests__/base-config.service.spec.ts) — 문자열·숫자·boolean 환경 설정 조회와 오류를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/date-time-range/__tests__/date-time-range.spec.ts`](libs/common/src/date-time-range/__tests__/date-time-range.spec.ts) — 날짜·시간 범위 생성과 경계 유효성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/idempotency/__tests__/errors.spec.ts`](libs/common/src/idempotency/__tests__/errors.spec.ts) — 멱등성 오류 코드와 응답 형태를 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### health·인프라 모듈

- [`src/health/__tests__/nats.health-indicator.spec.ts`](libs/common/src/health/__tests__/nats.health-indicator.spec.ts) — NATS health 성공·실패를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/health/__tests__/redis.health-indicator.spec.ts`](libs/common/src/health/__tests__/redis.health-indicator.spec.ts) — Redis health 성공·실패를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/mongodb/__tests__/crud.repository.spec.ts`](libs/common/src/mongodb/__tests__/crud.repository.spec.ts) — Mongo CRUD repository의 초기화, insert/mapping, 조회·삭제와 pagination 계약을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/mongodb/__tests__/mongo.util.spec.ts`](libs/common/src/mongodb/__tests__/mongo.util.spec.ts) — ObjectId, 문서 mapping, query builder, Mongo 오류와 plain object helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/nats/__tests__/nats-pubsub.service.spec.ts`](libs/common/src/nats/__tests__/nats-pubsub.service.spec.ts) — NATS publish/subscribe, 소비 loop 오류, decorator와 module 등록을 검증한다.
  **판정: 유지 · 시드: 핵심.** 도착 검증은 이미 bounded polling을 사용한다. 남은 고정 대기는 unsubscribe 뒤 메시지가 오지 않는다는 음의 assertion의 관찰 창이므로 유지한다.
- [`src/nats/__tests__/nats.module.spec.ts`](libs/common/src/nats/__tests__/nats.module.spec.ts) — NATS connection token, registry와 module 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/redis/__tests__/redis.module.spec.ts`](libs/common/src/redis/__tests__/redis.module.spec.ts) — standalone Redis registry와 `forRoot`/`forRootAsync` 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/redis/__tests__/redis.module.cluster.spec.ts`](libs/common/src/redis/__tests__/redis.module.cluster.spec.ts) — Redis cluster module 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/s3/__tests__/s3-object.service.spec.ts`](libs/common/src/s3/__tests__/s3-object.service.spec.ts) — presigned upload/download, 메타데이터·체크섬·크기 제한, 완료 확인, 목록·삭제·put과 client 종료를 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### 로깅·도메인 helper

- [`src/lat-long/__tests__/lat-long.spec.ts`](libs/common/src/lat-long/__tests__/lat-long.spec.ts) — 위경도 거리 계산과 HTTP 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/app-logger.service.spec.ts`](libs/common/src/logger/__tests__/app-logger.service.spec.ts) — 애플리케이션 logger의 level·context 전달을 검증한다.
  **판정: 축소 · 시드: 핵심.** level별 동일 위임 검사는 table-driven 한 묶음으로 합칠 수 있다.
- [`src/logger/__tests__/create-winston-logger.spec.ts`](libs/common/src/logger/__tests__/create-winston-logger.spec.ts) — Winston logger 생성과 포맷·transport 구성을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/exception-logger.filter.spec.ts`](libs/common/src/logger/__tests__/exception-logger.filter.spec.ts) — HTTP·비HTTP 예외 로깅과 성공 interceptor 부재 시 timing 처리를 검증한다.
  **판정: 유지 · 시드: 핵심.** 실제 HTTP interceptor부터 filter까지의 50ms 경계를 보는 테스트이며 별도 clock 주입보다 현재 코드가 단순하다.
- [`src/logger/__tests__/redact.spec.ts`](libs/common/src/logger/__tests__/redact.spec.ts) — 민감 필드 redaction을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/logger/__tests__/request-timing.spec.ts`](libs/common/src/logger/__tests__/request-timing.spec.ts) — 요청 시작·종료 시간 측정을 검증한다.
  **판정: 유지 · 시드: 핵심.** 총 80ms의 `performance.now()` 검증을 위해 clock seam이나 fake timer를 추가할 실익이 없다.
- [`src/logger/__tests__/success-logger.interceptor.spec.ts`](libs/common/src/logger/__tests__/success-logger.interceptor.spec.ts) — 성공 요청 로그와 제외 경로 동작을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/pagination/__tests__/pagination.spec.ts`](libs/common/src/pagination/__tests__/pagination.spec.ts) — pagination DTO 기본값·경계와 HTTP 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**

#### 범용 utility

- [`src/utils/__tests__/async.spec.ts`](libs/common/src/utils/__tests__/async.spec.ts) — 비동기 sleep helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/base64.spec.ts`](libs/common/src/utils/__tests__/base64.spec.ts) — Base64 인코딩·디코딩을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/byte.spec.ts`](libs/common/src/utils/__tests__/byte.spec.ts) — byte 문자열 parsing·formatting과 잘못된 단위를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/checksum.spec.ts`](libs/common/src/utils/__tests__/checksum.spec.ts) — checksum 스키마, 파일·buffer hash를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/date.schema.spec.ts`](libs/common/src/utils/__tests__/date.schema.spec.ts) — Temporal 날짜·시간 입력 스키마를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/date.spec.ts`](libs/common/src/utils/__tests__/date.spec.ts) — 날짜 생성·변환·최솟값·최댓값·현재 시각·덧셈과 외부 `Date` 경계를 검증한다.
  **판정: 보완 · 시드: 핵심.** 프로덕션 `DateUtil.now()`는 이미 `Temporal.Now.instant()`을 쓴다. 호출 전후의 독립 대조값도 `performance.timeOrigin + performance.now()`로 만들어 테스트의 `Date.now()`를 제거한다.
- [`src/utils/__tests__/env.spec.ts`](libs/common/src/utils/__tests__/env.spec.ts) — 환경변수 문자열·숫자·boolean parsing을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/http.spec.ts`](libs/common/src/utils/__tests__/http.spec.ts) — `Content-Disposition` 생성과 escaping을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/id.spec.ts`](libs/common/src/utils/__tests__/id.spec.ts) — 짧은 ID 생성과 객체 ID 추출을 검증한다.
  **판정: 축소 · 시드: 핵심.** 형식·길이 검사는 남기고 임의 ID 두 개가 다르다는 확률 단언만 제거한다. 이 테스트를 위해 난수원 주입 코드는 추가하지 않는다.
- [`src/utils/__tests__/json.spec.ts`](libs/common/src/utils/__tests__/json.spec.ts) — JSON parse/stringify, Temporal·오류·특수값 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/lodash.spec.ts`](libs/common/src/utils/__tests__/lodash.spec.ts) — 프로젝트 내부 lodash 대체 helper의 조회·선택·집계·비교 동작을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/path.spec.ts`](libs/common/src/utils/__tests__/path.spec.ts) — 절대 경로, basename/dirname과 파일시스템 경계를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/time.spec.ts`](libs/common/src/utils/__tests__/time.spec.ts) — 시간 단위와 millisecond 변환을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/utils/__tests__/validator.spec.ts`](libs/common/src/utils/__tests__/validator.spec.ts) — `Require`, `Assume`, `ensure` 유효성 helper를 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `libs/testing` — 6개

- [`src/__tests__/create-test-context.spec.ts`](libs/testing/src/__tests__/create-test-context.spec.ts) — Nest test context 생성, override와 lifecycle을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/create-test-context-cleanup.spec.ts`](libs/testing/src/__tests__/create-test-context-cleanup.spec.ts) — setup 중 실패했을 때 부분 생성된 test context를 정리하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/expect-equal-unsorted.spec.ts`](libs/testing/src/__tests__/expect-equal-unsorted.spec.ts) — 순서와 무관한 동등성 matcher를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/http.test-client.spec.ts`](libs/testing/src/__tests__/http.test-client.spec.ts) — JSON 응답, 상태 코드, multipart, SSE와 chain API를 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`src/__tests__/utils.spec.ts`](libs/testing/src/__tests__/utils.spec.ts) — Temporal fixture, 단계 실행, test ID, ObjectId와 debug 감지를 검증한다.
  **판정: 보완 · 시드: 핵심.** 프로덕션 인자를 추가하지 않고 `node:inspector`의 `url()`만 국소 mock해 debugger 연결·비연결 두 경우를 검증한다.
- [`src/vitest/__tests__/decorator-metadata.spec.ts`](libs/testing/src/vitest/__tests__/decorator-metadata.spec.ts) — TypeScript 기반 Vitest 변환이 Nest DI decorator metadata를 보존하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**

### `tests/api-race/contracts` — 2개

- [`race-common.test.js`](tests/api-race/contracts/race-common.test.js) — HTTP 전체 deadline과 SSE handshake deadline, 정상 응답 parsing과 연결 정리를 검증한다.
  **판정: 보완 · 시드: 핵심.** `waitFor`의 경과시간 deadline은 wall clock인 `Date.now()` 대신 `performance.now()`를 사용한다.
- [`repository-contract.test.js`](tests/api-race/contracts/repository-contract.test.js) — 실제 race 파일 목록이 Stability workflow와 문서의 시나리오 목록과 일치하는지 검사한다.
  **판정: 축소 · 시드: 선택.** 시나리오가 workflow에 모두 등록됐다는 보장은 유효하지만 문서 문자열과의 대조는 하나의 manifest 생성으로 대체한다.

### `tests/web` — 5개

- [`contracts/bff-proxy.spec.ts`](tests/web/contracts/bff-proxy.spec.ts) — Console/User BFF의 Origin·Host와 proxy IP 신뢰 경계, refresh 재시도 시 회전 쿠키 보존을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`contracts/frontend-lint.spec.ts`](tests/web/contracts/frontend-lint.spec.ts) — 두 Next 앱에 React hooks, 접근성, Next image lint 규칙이 실제로 적용되는지 검증한다.
  **판정: 축소 · 시드: 선택.** 실제 위반 파일을 lint하는 방식은 유효하나 동일 shared 규칙은 한 번만 검증하고 두 앱 자체 lint로 적용 범위를 보장할 수 있다.
- [`e2e/console-auth-flow.spec.ts`](tests/web/e2e/console-auth-flow.spec.ts) — 관리자 route 보호, 역할 분리, HttpOnly 세션, refresh 단일화, cache 금지, logout, IP rate limit과 body 제한을 브라우저로 검증한다.
  **판정: 보완 · 시드: 예제.** IP rate-limit용 고유 stamp는 이미 있는 `randomUUID()`만 사용하고 `Date.now()`를 제거한다.
- [`e2e/movies-flow.spec.ts`](tests/web/e2e/movies-flow.spec.ts) — 관리자 로그인 후 영화 생성·수정·발행 재시도, 극장 생성과 사용자 삭제를 브라우저로 검증한다.
  **판정: 보완 · 시드: 예제.** 영화·극장 이름과 삭제용 이메일의 고유 suffix는 `randomUUID()`로 만들고 `Date.now()`를 제거한다.
- [`e2e/user-auth-flow.spec.ts`](tests/web/e2e/user-auth-flow.spec.ts) — 사용자 역할 분리, 로그인·개인화 홈, access 만료 후 refresh 회전과 logout을 브라우저로 검증한다.
  **판정: 보완 · 시드: 예제.** 가입 이메일은 이미 포함된 `randomUUID()`만으로 충분하므로 `Date.now()`를 제거한다.

### `tools` — 7개

- [`__tests__/ci-diagnostics.test.mjs`](tools/__tests__/ci-diagnostics.test.mjs) — CI 진단 wrapper가 stdout/stderr를 보존하고 원래 종료 코드를 전달하는지 검증한다.
  **판정: 유지 · 시드: 선택.**
- [`__tests__/clean-workspace.test.mjs`](tools/__tests__/clean-workspace.test.mjs) — 생성물만 지우고 개인 파일·테스트 보고서를 보존하며 symlink workspace를 거부하는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`__tests__/configuration-contract.test.mjs`](tools/__tests__/configuration-contract.test.mjs) — workspace, lint, devcontainer, Docker, ESM, 배포·인프라와 workflow 설정의 정책 계약 18개를 검사한다.
  **판정: 제거 후보 · 시드: 선택.** 서로 무관한 정책 snapshot을 묶은 메타 테스트이며 AtoZ의 실제 install·lint·build·배포 검증과 대부분 겹친다. 계속 강제할 소수 정책은 필요해질 때 전용 lint로 분리한다.
- [`__tests__/lint-shell.test.mjs`](tools/__tests__/lint-shell.test.mjs) — extension 없는 hook과 source된 fixture까지 shell lint 대상에 포함되는지 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`dev-tools/tunnel-policy.test.sh`](tools/dev-tools/tunnel-policy.test.sh) — cloudflared quick tunnel의 허용 포트, 시작 실패, 중복 실행과 child process 정리를 검증한다.
  **판정: 유지 · 시드: 선택.**
- [`vitest-helpers/__tests__/helpers.test.js`](tools/vitest-helpers/__tests__/helpers.test.js) — test resource ID, Mongo/S3/Redis 준비·정리와 Vitest lifecycle 연결을 검증한다.
  **판정: 유지 · 시드: 핵심.**
- [`vitest-helpers/__tests__/resource-scope.test.js`](tools/vitest-helpers/__tests__/resource-scope.test.js) — 병렬 run의 Mongo/S3/Redis namespace와 fail-closed 정리 범위를 검증한다.
  **판정: 유지 · 시드: 핵심.**

## 이름 규칙 밖의 실행 테스트와 측정 파일

### 실행 가능한 API 문서 — 9개, curl 검증 83건

이 파일들은 `api-docs/run.sh`가 source해서 실제 배포 API에 curl 요청을 보낸다. 각 성공·실패 요청의 예상 HTTP status를 검사하고 실제 응답 body와 오류 code를 문서 로그에 남긴다. 따라서 API 통합 테스트와 같은 endpoint를 호출하더라도 중복 테스트로 보지 않는다.

- [`admins.spec`](apps/api/api-docs/admins.spec) — root/admin 생성·인증·수정·삭제와 권한 오류 13건.
  **판정: 유지 · 시드: 예제.** Basic Auth 누락·비밀번호 오류·잘못된 scheme, 이메일 충돌과 폐기된 refresh token처럼 서로 다른 실패 응답을 문서화한다.
- [`booking.spec`](apps/api/api-docs/booking.spec) — 극장·상영일·상영시간·티켓 조회와 선점 5건.
  **판정: 유지 · 시드: 예제.** 이미 배포된 API의 문서 예제가 끝까지 작동하는지 보는 경계라 통합 테스트와의 endpoint 중복이 타당하다.
- [`health.spec`](apps/api/api-docs/health.spec) — 서비스 health 1건.
  **판정: 유지 · 시드: 핵심.** 비용이 작고 배포 stack의 최소 생존 신호라 남긴다.
- [`movies.spec`](apps/api/api-docs/movies.spec) — 영화 CRUD·목록·발행과 오류 12건.
  **판정: 유지 · 시드: 예제.** CRUD·발행·presigned upload의 전체 curl 예시와 조회·수정 404 응답을 함께 문서화한다.
- [`purchases.spec`](apps/api/api-docs/purchases.spec) — 티켓 구매, 멱등 재시도·충돌과 사용자 구매 조회 6건.
  **판정: 유지 · 시드: 예제.** 배포 환경의 구매·멱등성 흐름을 함께 증명하므로 통합 테스트와 실행 경계가 다르다.
- [`showtime-creation.spec`](apps/api/api-docs/showtime-creation.spec) — 상영 생성용 자원 조회, workflow 요청과 검색 4건.
  **판정: 유지 · 시드: 예제.** Restate가 연결된 배포 workflow의 실제 호출 예제로 필요하다.
- [`theaters.spec`](apps/api/api-docs/theaters.spec) — 극장 CRUD와 validation 8건.
  **판정: 유지 · 시드: 예제.** 정상 CRUD와 필수 값 누락 400, 조회·수정 404의 공개 응답을 문서화한다.
- [`users.spec`](apps/api/api-docs/users.spec) — 가입·로그인·refresh·내 정보·관리·인가 오류 32건.
  **판정: 유지 · 시드: 예제.** 가입 validation·409, 로그인·refresh 401, 사용자/admin 권한 경계, logout·계정 삭제 이후 상태까지 공개 성공·실패 계약을 문서화한다.
- [`views.spec`](apps/api/api-docs/views.spec) — 게스트와 로그인 사용자의 홈 view 2건.
  **판정: 유지 · 시드: 예제.** 게스트와 로그인 사용자의 배포 응답 차이를 보여 주는 최소 문서 예제다.

### 4-replica API race — 시나리오 8개와 probe 1개

- [`user-signup-race.js`](tests/api-race/user-signup-race.js) — 같은 이메일 동시 가입에서 정확히 하나만 생성되는지 검증한다.
  **판정: 보완 · 시드: 예제.** 이메일은 iteration·group·`secureRandomHex()`만으로 고유하므로 `Date.now()`를 제거한다.
- [`jwt-refresh-race.js`](tests/api-race/jwt-refresh-race.js) — 같은 refresh token 동시 회전에서 하나만 성공하고 승자 token family가 유지되는지 검증한다.
  **판정: 보완 · 시드: 예제.** 이메일은 suffix와 `secureRandomHex()`만으로 고유하므로 `Date.now()`를 제거한다.
- [`ticket-holding-race.js`](tests/api-race/ticket-holding-race.js) — 같은 좌석 동시 선점에서 그룹마다 하나만 성공하는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`showtime-overlap-race.js`](tests/api-race/showtime-overlap-race.js) — 서로 겹치는 상영 생성 workflow 중 하나만 성공하는지 검증한다.
  **판정: 보완 · 시드: 예제.** 미래 상영 기준과 10분 간격 계산을 `Temporal.Now.instant()`과 `Temporal.Instant.add()`로 바꿔 `Date.now()`를 제거한다.
- [`purchase-double-spend.js`](tests/api-race/purchase-double-spend.js) — 같은 티켓 묶음 동시 결제에서 하나의 실제 구매만 남는지 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`purchase-overlap-race.js`](tests/api-race/purchase-overlap-race.js) — 일부 티켓이 겹치는 다른 lock key의 구매에서 원자 전이와 패자 보상을 검증한다.
  **판정: 유지 · 시드: 예제.**
- [`sse-fanout-race.js`](tests/api-race/sse-fanout-race.js) — 여러 replica의 모든 SSE client가 모든 workflow 성공 이벤트를 받는지 검증한다.
  **판정: 보완 · 시드: 예제.** 서로 겹치지 않는 미래 상영 시각을 `Temporal.Now.instant()`과 `Temporal.Instant.add()`로 만들어 `Date.now()`를 제거한다.
- [`replica-chaos.js`](tests/api-race/replica-chaos.js) — 트래픽 중 replica 하나를 kill/start해 NGINX 우회와 복구 후 replica 참여를 검증한다.
  **판정: 보완 · 시드: 핵심.** load balancer 우회와 replica 복귀 검증은 유지하되, 복구 deadline과 경과시간은 `performance.now()`로 계산한다. 트래픽 이메일도 worker ID와 `secureRandomHex()`만 사용한다.
- [`probes/restate-journal-recovery.js`](tests/api-race/probes/restate-journal-recovery.js) — Restate SIGKILL 재시작 뒤 완료 step은 replay하고 중단 step만 다시 실행하는지 검증한다.
  **판정: 보완 · 시드: 핵심.** 실제 journal replay 검증은 유지하되, 60초 polling deadline은 `performance.now()`로 계산하고 workflow 이름과 key는 `randomUUID()`로 만든다.

### API benchmark — 합격/실패가 아닌 비교 측정

- [`harness-crud.js`](tests/api-benchmark/harness-crud.js) — 사용자·극장·health 등 CRUD 읽기/쓰기 시나리오의 RPS와 latency를 측정한다.
  **판정: 보완 · 시드: 선택.** 이메일·극장·영화 이름은 VU·iteration·`secureRandomHex()`만으로 만들고, 측정 구간 판정은 `exec.scenario.progress`를 사용해 `Date.now()`를 제거한다.
- [`harness-refresh.js`](tests/api-benchmark/harness-refresh.js) — refresh token 회전 경로의 Redis·Mongo 결합 비용을 측정한다.
  **판정: 보완 · 시드: 선택.** setup의 고유 seed는 `secureRandomHex()`를 사용하고 측정 구간 판정은 `exec.scenario.progress`로 바꿔 `Date.now()`를 모두 제거한다.
- [`harness-user-filter.js`](tests/api-benchmark/harness-user-filter.js) — 사용자 이름 부분 문자열 검색의 collection scan 비용을 측정한다.
  **판정: 보완 · 시드: 선택.** setup seed는 `secureRandomHex()`를 사용하고 측정 구간 판정은 `exec.scenario.progress`로 바꿔 `Date.now()`를 모두 제거한다. 측정 자체는 유효하지만 영화 예제의 사용자 검색을 버리면 함께 교체한다.
- [`mixed-runner.sh`](tests/api-benchmark/mixed-runner.sh) — 단독 read/write와 혼합 부하 행렬을 실행하고 결과를 비교한다.
  **판정: 유지 · 시드: 선택.**
- [`runner.sh`](tests/api-benchmark/runner.sh) — 배포 스택 기동, 대량 seed, 측정과 정리를 한 번에 수행한다.
  **판정: 유지 · 시드: 선택.**

### 배포 검증

- [`deploy/verify.sh`](deploy/verify.sh) — 실제 compose stack을 build·기동하고 Restate endpoint 등록, journal recovery probe와 83개 curl 문서를 실행한 뒤 stack을 정리한다.
  **판정: 유지 · 시드: 핵심.** build 결과물·Compose wiring·Restate 등록을 함께 보는 artifact-level acceptance라 단위 테스트로 대체할 수 없다.

## 주요 테스트 지원 파일

지원 파일은 직접 테스트 케이스를 선언하지 않지만 어떤 테스트가 어떻게 실행되는지를 결정한다.

| 파일                                                                                                     | 역할                                                                                                                                                    | 평가            |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| [`tests/run-and-report.mjs`](tests/run-and-report.mjs)                                                   | 루트 `test`, `atoz`, `e2e`, `race`, `benchmark` 단계를 실행하고 Markdown 보고서를 작성한다.                                                             | **유지 · 핵심** |
| [`vitest.config.base.mjs`](vitest.config.base.mjs)                                                       | 세 Vitest workspace의 Node 환경, include pattern, timeout, 격리와 TypeScript decorator metadata 변환을 정의한다.                                        | **유지 · 핵심** |
| [`apps/api/vitest.config.mjs`](apps/api/vitest.config.mjs)                                               | API alias, run별 coverage 경로, 100% coverage gate, global/setup 파일을 정의한다.                                                                       | **유지 · 핵심** |
| [`apps/api/vitest.global.cjs`](apps/api/vitest.global.cjs)                                               | config에서 만든 API Vitest run ID와 output 경로가 worker·teardown에 동일하게 전달됐는지 확인한다.                                                       | **유지 · 핵심** |
| [`apps/api/vitest.teardown.cjs`](apps/api/vitest.teardown.cjs)                                           | 현재 API Vitest run의 Mongo, S3, Redis와 JetStream 자원을 정리한다.                                                                                     | **유지 · 핵심** |
| [`apps/api/src/__tests__/vitest.setup.ts`](apps/api/src/__tests__/vitest.setup.ts)                       | API test file별 Mongo·S3 연결과 test namespace를 준비하며 JetStream은 테스트 사이에 유지한다.                                                           | **유지 · 핵심** |
| [`apps/api/scripts/vitest-run-context.cjs`](apps/api/scripts/vitest-run-context.cjs)                     | run ID와 실행별 output/coverage 디렉터리를 생성한다.                                                                                                    | **유지 · 핵심** |
| [`apps/api/scripts/vitest-resource-wiring.cjs`](apps/api/scripts/vitest-resource-wiring.cjs)             | run/worker별 Mongo, S3, Redis, NATS 자원 이름과 환경변수를 연결한다.                                                                                    | **유지 · 핵심** |
| [`apps/api/scripts/shared-test-mongo-connection.cjs`](apps/api/scripts/shared-test-mongo-connection.cjs) | test file 수명의 공유 native Mongo 연결을 제공한다.                                                                                                     | **유지 · 핵심** |
| [`libs/common/vitest.config.mjs`](libs/common/vitest.config.mjs)                                         | common의 coverage gate와 setup/global teardown을 정의한다.                                                                                              | **유지 · 핵심** |
| [`libs/common/vitest.global.cjs`](libs/common/vitest.global.cjs)                                         | common 통합 테스트가 쓸 Mongo·NATS 등 전역 자원을 준비한다.                                                                                             | **유지 · 핵심** |
| [`libs/common/vitest.teardown.cjs`](libs/common/vitest.teardown.cjs)                                     | common 전역 테스트 자원을 정리한다.                                                                                                                     | **유지 · 핵심** |
| [`libs/common/src/__tests__/vitest.setup.ts`](libs/common/src/__tests__/vitest.setup.ts)                 | common test file별 setup을 연결한다.                                                                                                                    | **유지 · 핵심** |
| [`libs/testing/vitest.config.mjs`](libs/testing/vitest.config.mjs)                                       | testing library의 Vitest 설정을 정의한다.                                                                                                               | **유지 · 핵심** |
| [`libs/testing/src/__tests__/vitest.setup.ts`](libs/testing/src/__tests__/vitest.setup.ts)               | 각 testing library 테스트 전에 Vitest module cache를 초기화한다.                                                                                        | **유지 · 핵심** |
| [`tests/web/playwright.contract.config.ts`](tests/web/playwright.contract.config.ts)                     | 브라우저와 web server 없이 `contracts`만 실행한다.                                                                                                      | **유지 · 핵심** |
| [`tests/web/playwright.config.ts`](tests/web/playwright.config.ts)                                       | Compose가 주입한 앱 URL을 사용해 Chromium E2E, trace, screenshot과 report를 구성한다.                                                                   | **유지 · 핵심** |
| [`apps/api/api-docs/run.sh`](apps/api/api-docs/run.sh)                                                   | `*.spec` 파일의 `TEST`/`SETUP`을 실행하고 응답·요약 보고서를 생성한다.                                                                                  | **유지 · 핵심** |
| [`apps/api/api-docs/common.fixture`](apps/api/api-docs/common.fixture)                                   | API 문서의 로그인과 영화·극장·상영 fixture를 제공한다.                                                                                                  | **유지 · 예제** |
| [`apps/api/api-docs/log-redaction.sh`](apps/api/api-docs/log-redaction.sh)                               | API 문서 로그에서 민감값을 제거한다.                                                                                                                    | **유지 · 핵심** |
| [`tests/api-race/runner.sh`](tests/api-race/runner.sh)                                                   | 선택한 race를 위해 4-replica stack을 준비·실행·진단·정리한다.                                                                                           | **유지 · 핵심** |
| [`tests/api-race/race-common.js`](tests/api-race/race-common.js)                                         | race용 HTTP/SSE client, deadline과 공통 fixture를 제공한다. deadline은 `performance.now()`, 미래 상영 시각은 `Temporal`, 생성 이메일은 난수만 사용한다. | **보완 · 핵심** |
| [`tests/api-benchmark/perf-common.js`](tests/api-benchmark/perf-common.js)                               | k6 옵션, 측정 구간, 상태 코드와 JSON/HTML summary 생성을 제공한다. `measurementStart()` 대신 scenario 진행률 기반 helper를 제공한다.                    | **보완 · 선택** |
| [`.github/workflows/test-atoz.yaml`](.github/workflows/test-atoz.yaml)                                   | PR·push·schedule에서 전체 AtoZ 회귀를 실행하고 진단 artifact를 보존한다.                                                                                | **유지 · 핵심** |
| [`.github/workflows/test-stability.yaml`](.github/workflows/test-stability.yaml)                         | 단위·통합·부팅·race 시나리오를 누적 반복해 간헐 실패를 찾는다.                                                                                          | **유지 · 선택** |
| [`.github/scripts/repeat.sh`](.github/scripts/repeat.sh)                                                 | Stability 명령 반복과 실패 시 현재 Compose 프로젝트 진단을 담당한다.                                                                                    | **유지 · 선택** |
| [`.github/scripts/run-with-ci-diagnostics.sh`](.github/scripts/run-with-ci-diagnostics.sh)               | 명령 출력을 저장하고 실패 진단을 남기면서 원래 종료 코드를 보존한다.                                                                                    | **유지 · 선택** |

## 이 문서를 갱신할 때

1. 표준 테스트 파일 목록과 105개 기준을 다시 계산한다.
2. 새 파일이 루트 `test`, `atoz`, 전용 `e2e`·`race`·`benchmark` 중 어디에서 실행되는지 적는다.
3. 새 파일에는 `유지`·`보완`·`축소`·`제거 후보`와 `핵심`·`예제`·`선택` 판정을 함께 적는다.
4. fixture와 helper를 테스트 케이스처럼 세지 않는다.
5. benchmark는 회귀 비교 측정이며 합격선이 없다는 점을 유지한다.
