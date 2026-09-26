# nest-seed

NestJS 프로젝트를 시작할 때 가져다 쓰고 고칠 수 있는 시드다. `apps/api`가 본체이고 `libs/`는 다른 NestJS 프로젝트에도 사용할 공통 코드다. 영화 예매는 모듈 협력·데이터 정합성·외부 연동을 설명하는 예제이며, `console`과 `user-app`은 API에 연결하는 작은 Next.js 데모다.

단순 CRUD부터 시작해 필요한 경계를 차례로 읽는다.

| 읽을 코드                                                                 | 보여 주는 것                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| [theaters](apps/api/src/services/core/theaters/)                          | 서비스·저장소·DTO의 기본 구성                   |
| [booking](apps/api/src/services/application/booking/)                     | 여러 도메인의 공개 API를 조합하는 유스케이스    |
| [home](apps/api/src/services/view/user-app/home/)                         | 화면에 필요한 읽기 응답 조합                    |
| [showtime-creation](apps/api/src/services/application/showtime-creation/) | 비동기 접수, Restate 실행, DB transaction과 SSE |
| [purchase](apps/api/src/services/application/purchase/)                   | 한 상영의 티켓 구매, 멱등성·보상·완료 알림      |

각 코드와 같은 이름의 [API 통합 테스트](apps/api/src/__tests__/)를 함께 읽으면 입력·응답과 저장 결과의 계약을 확인할 수 있다. 실제 PG, 여러 상영관을 갖는 극장 모델, 예매 전체 UI는 구현하지 않는다.

## 시작하기

공식 개발 경로는 Dev Container다. Docker가 있는 호스트의 저장소를 VS Code Remote SSH로 열고 Dev Containers 확장을 사용한다. 호스트와 컨테이너의 workspace 절대경로는 같아야 한다. 이유는 [개발 환경](docs/devcontainer.md)에 있다.

1. VS Code에서 `Reopen in Container`를 실행한다. 시작할 때 개발 인프라를 초기화하고 의존성을 준비한다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`를 실행하고 `curl http://localhost:3000/health`로 API를 확인한다.
4. VS Code의 포트 패널에서 console의 `3100`, user-app의 `3200`을 전달한다. 자동 포트 전달은 꺼져 있다.
5. console은 개발 admin(`admin@nest-seed.local` / `DevPass1!`)으로 로그인한다. user-app에서는 가입·로그인과 홈 화면을 확인한다.

Dev Container 시작, `bash infra/reset.sh`, `pnpm run atoz`는 개발 데이터를 지운다. DB·S3 파일·Restate journal·JetStream 이벤트를 보존할 환경에서 실행하지 않는다. 초기화 뒤 개발 admin도 다시 만들어진다.

루트 `.env.api`와 `.env.infra`는 커밋된 개발·검증 값이다. 수정한 값은 Dev Container를 재생성해야 반영된다. 운영 secret은 저장소 밖에서 주입한다. env 파일의 역할과 실제 주입 경로는 [개발 환경](docs/devcontainer.md)이 설명한다.

## 실행과 검증

아래 명령은 Dev Container의 저장소 루트에서 실행한다. 루트 명령은 필요한 workspace 준비 단계를 포함한다.

| 명령                       | 용도                                                           |
| -------------------------- | -------------------------------------------------------------- |
| `pnpm run dev`             | API와 두 데모를 watch mode로 실행                              |
| `pnpm run test`            | workspace의 단위·통합 테스트                                   |
| `pnpm run lint`            | 타입·코드·format·shell·문서 링크 검사                          |
| `pnpm run atoz`            | 인프라 초기화부터 build·테스트·브라우저·API 문서까지 전체 회귀 |
| `pnpm run api-docs`        | 복제본 4개의 API 스택에서 실행 가능한 문서 검증                |
| `pnpm run e2e`             | production build의 데모와 API 연결 검증                        |
| `pnpm run race <scenario>` | 다중 복제본의 HTTP/SSE 경쟁 또는 복제본 종료 시나리오          |
| `pnpm run benchmark`       | 같은 조건의 API 성능 비교                                      |

race와 benchmark는 기본 test·AtoZ에 포함되지 않는다. 같은 API Vitest 명령을 동시에 두 번 실행하는 것은 지원하지 않는다. 커버리지 100%와 반복 CI는 검증되지 않은 경로와 간헐 실패를 드러내는 개발 제약이며, 모든 버그가 없다는 보장은 아니다. 테스트별 목적과 검증 한계는 [tests 가이드](docs/tests.md)에 있다.

### 필요한 테스트만 실행하기

한 API spec을 확인할 때는 먼저 라이브러리를 준비하고 파일 패턴을 넘긴다. 부분 실행은 전체 100% 게이트의 대상이 아니므로 coverage를 끈다. 변경 완료 검증에서는 해당 workspace의 전체 게이트를 다시 통과해야 한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

API 사용 예시는 [api-docs](apps/api/api-docs/)의 bash·curl spec이 소유한다. 실행 중인 개발 API를 대상으로 한 문서만 실행할 수도 있다.

```bash
bash apps/api/api-docs/run.sh showtime-creation.spec
```

spec에 요청이 있고, 실행 결과에는 실제 응답이 기록된다. 주요 성공·실패 흐름을 실행하는 문서이므로 전체 라우트 카탈로그나 통합 테스트의 모든 단언을 대신하지 않는다.

`pnpm run race`는 시나리오 목록, `pnpm run e2e:list`는 브라우저 테스트 목록을 보여 준다. 브라우저 interactive 실행은 `pnpm run e2e:ui`를 사용한다.

Playwright 버전을 바꾸면 browser binary와 OS 의존성도 맞춰야 한다. Dev Container 시작·AtoZ는 Chromium 설치를 실행하며, 설치만 다시 할 때는 다음 명령을 쓴다.

```bash
pnpm --filter './tests/web' exec playwright install chromium
```

### 결과와 진단

- 단위·통합 테스트와 race 결과는 터미널에서 확인한다. race 실패에는 스택 정리 전 컨테이너·MongoDB 진단도 남는다.
- 브라우저의 trace·screenshot·HTML 결과는 `tests/web/_output/`에 있다. `pnpm run e2e:report`로 마지막 보고서를 연다.
- API 문서의 실제 응답은 `apps/api/api-docs/_output/logs/`, 실행 항목 요약은 같은 `_output/docs/summary.md`에 있다.
- benchmark는 `tests/api/benchmark/_output/<실행 시각>/`에 `report.html`과 `summary.json`을 남긴다. 측정용 극장 데이터는 DB에 남으며 `bash infra/reset.sh`로 초기화한다.

CI 반복의 실패 회차는 `[Run i/N]`에서 찾는다. API Race의 runner 진단과 같은 시각의 컨테이너 로그를 함께 본다. 실패 후 MongoDB 상태 snapshot 하나만으로 당시 원인을 확정하지 않는다.

## 구조와 선택

API는 Gateway → View → Application → Core → Infrastructure 방향의 SoLA 경계를 사용한다. 필요한 하위 계층은 직접 호출할 수 있으며, 같은 계층의 다른 모듈을 조합할 때는 상위 유스케이스가 협력을 맡는다. 단일 Core의 CRUD에 Application 계층을 추가하지 않는다.

MongoDB는 주 데이터와 transaction, Redis는 선점·리프레시 세션, NATS는 실시간 전달, JetStream은 보존할 메시지, Restate는 중단 후 실행 재개를 맡는다. SDK 연결과 실행은 common이, 업무 쿼리·정책·workflow 단계는 API가 소유한다. 선택 이유와 한계는 [설계 결정](docs/reference/decisions.md)에 있다.

| 위치             | 안내                                                     |
| ---------------- | -------------------------------------------------------- |
| `apps/`          | [모듈 경계, 업무 흐름, 인증과 DTO](docs/apps.md)         |
| `libs/`          | [공통화 기준과 공개 계약](docs/libs.md)                  |
| `tests/`         | [다중 프로세스·브라우저·성능 검증의 범위](docs/tests.md) |
| `infra/`         | [개발 topology와 reset의 범위](docs/infra.md)            |
| `tools/`         | [개발·테스트 실행 도구](docs/tools.md)                   |
| `.devcontainer/` | [개발 환경과 env 주입](docs/devcontainer.md)             |

공통 작성 규칙은 [네이밍·타입·오류·테스트 규칙](docs/reference/conventions.md)에 둔다. 할 일과 미결 검토가 생기면 루트 `_todo/`에서 관리한다.

## 기능·코드 변경 시 주의사항

시드 구성은 가져다 쓰고 고치기 쉬운 출발점인지, `libs/`는 여러 프로젝트에서 사용할 공개 계약이 정확한지 판단한다. 상세 변경 기준, 전체 리뷰 점검 목록, TODO 관리와 포크 시 주의사항은 [프로젝트 변경·검토 기준](docs/reference/project-review.md)을 따른다.
