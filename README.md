# nest-seed

NestJS 프로젝트를 시작할 때 가져다 쓰고 고칠 수 있는 시드다. `apps/api`가 중심 API이고 `libs/`에는 다른 NestJS 프로젝트에서도 사용할 공통 코드가 있다. 영화 예매 예제로 모듈 간 협력, 데이터 정합성, 외부 서비스 연동을 설명한다. `console`과 `user-app`은 API에 연결하는 작은 Next.js 데모다.

단순 CRUD부터 시작해 모듈 조합과 비동기 처리를 차례로 살펴본다.

| 읽을 코드                                                                 | 보여 주는 것                                 |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| [theaters](apps/api/src/services/core/theaters/)                          | 서비스·저장소·DTO의 기본 구성                |
| [booking](apps/api/src/services/application/booking/)                     | 여러 도메인의 공개 API를 조합하는 유스케이스 |
| [home](apps/api/src/services/view/user-app/home/)                         | 화면에 필요한 읽기 응답 조합                 |
| [showtime-creation](apps/api/src/services/application/showtime-creation/) | 비동기 접수, Restate 실행, DB 트랜잭션과 SSE |
| [purchase](apps/api/src/services/application/purchase/)                   | 한 상영의 티켓 구매, 멱등성·보상·완료 알림   |

각 코드와 같은 이름의 [API 통합 테스트](apps/api/src/__tests__/)를 함께 읽으면 허용하는 입력, 응답 형태, 저장 결과를 확인할 수 있다. 실제 결제 대행사(PG) 연동, 여러 상영관을 갖는 극장 모델, 예매 전체 UI는 구현하지 않는다.

## 시작하기

새 프로젝트로 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(`@mannercode/*` 패키지 scope 포함)를 사용할 이름으로 바꾼다.

지원하는 개발 환경은 Dev Container다. Docker가 있는 호스트의 저장소를 VS Code Remote SSH로 열고 Dev Containers 확장을 사용한다. 호스트와 컨테이너에서 workspace의 절대경로가 같아야 하는 이유는 [개발 환경](docs/devcontainer.md)에 있다.

1. VS Code에서 `Reopen in Container`를 실행한다. 시작 과정에서 의존성을 설치하고 개발 인프라를 초기화한다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`를 실행하고 `curl http://localhost:3000/health`로 API를 확인한다.
4. VS Code의 포트 패널에서 console의 `3100`, user-app의 `3200`을 전달한다. 자동 포트 전달은 꺼져 있다.
5. console은 개발 admin(`admin@nest-seed.local` / `DevPass1!`)으로 로그인한다. user-app에서는 가입·로그인과 홈 화면을 확인한다.

Dev Container 시작, `bash infra/reset.sh`, `pnpm run atoz`는 개발 데이터를 지운다. DB·S3 파일·Restate journal·JetStream 이벤트를 보존할 환경에서 실행하지 않는다. 초기화 뒤 개발 admin도 다시 만들어진다.

루트 `.env.api`와 `.env.infra`에는 개발·검증용 설정값이 커밋되어 있다. 이 파일을 수정한 뒤에는 Dev Container를 재생성해야 변경한 값이 반영된다. 운영 secret은 저장소 밖에서 주입한다. 파일별 역할과 주입 방법은 [개발 환경](docs/devcontainer.md)에 있다.

## 실행과 검증

아래 명령은 Dev Container의 저장소 루트에서 실행한다. 각 명령에는 라이브러리 빌드 등 필요한 준비 단계가 포함되어 있다.

| 명령                       | 용도                                                          |
| -------------------------- | ------------------------------------------------------------- |
| `pnpm run dev`             | API와 두 데모를 watch mode로 실행                             |
| `pnpm run test`            | workspace의 단위·통합 테스트                                  |
| `pnpm run lint`            | 타입·코드·서식·셸·문서 링크 검사                              |
| `pnpm run atoz`            | 인프라 초기화부터 빌드·테스트·브라우저·API 문서까지 전체 회귀 |
| `pnpm run api-docs`        | 복제본 4개의 API 스택에서 실행 가능한 문서 검증               |
| `pnpm run e2e`             | production build의 데모와 API 연결 검증                       |
| `pnpm run race <scenario>` | 다중 복제본의 HTTP/SSE 경쟁 또는 복제본 종료 시나리오         |
| `pnpm run benchmark`       | 같은 조건의 API 성능 비교                                     |

race와 benchmark는 기본 test·AtoZ에 포함되지 않는다. 같은 API Vitest 명령을 동시에 여러 번 실행하는 것은 지원하지 않는다. 커버리지 100% 기준은 테스트가 실행하지 않은 코드 경로를, 반복 CI는 간헐적인 실패를 찾기 위한 제약이다. 테스트별 목적과 검증 범위는 [tests 가이드](docs/tests.md)에 있다.

### 필요한 테스트만 실행하기

특정 API spec만 실행할 때는 먼저 라이브러리를 빌드하고 테스트 파일 패턴을 지정한다. 일부 테스트만으로는 전체 코드의 커버리지 100%를 채울 수 없으므로 이때는 커버리지 수집을 끈다. 변경을 마칠 때는 해당 workspace의 전체 테스트와 커버리지 검사를 다시 통과해야 한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

API 사용 예시는 [api-docs](apps/api/api-docs/)의 bash·curl spec에 있다. 실행 중인 개발 API를 대상으로 전체 문서 또는 특정 문서만 검증할 수도 있다.

```bash
bash apps/api/api-docs/run.sh
bash apps/api/api-docs/run.sh showtime-creation.spec
```

요청은 spec에서, 실제 응답은 실행 결과에서 확인한다. 이 문서는 주요 성공·실패 흐름을 보여 주며 전체 API 목록이나 통합 테스트를 대신하지 않는다.

`pnpm run race`는 시나리오 목록을, `pnpm run e2e:list`는 브라우저 테스트 목록을 보여 준다. 브라우저 테스트를 화면에서 선택하고 실행하려면 `pnpm run e2e:ui`를 사용한다.

Playwright 버전을 바꾸면 Chromium과 브라우저 실행에 필요한 OS 패키지도 맞춰야 한다. Dev Container를 다시 빌드하는 방법은 [개발 환경](docs/devcontainer.md#3-시작-순서와-데이터-수명)을 따른다. Dev Container 시작·AtoZ는 Chromium을 설치하며, Chromium만 다시 설치할 때는 다음 명령을 쓴다.

```bash
pnpm --filter './tests/web' exec playwright install chromium
```

### 결과와 진단

- 단위·통합 테스트와 race 결과는 터미널에서 확인한다. race가 실패하면 검증 스택을 정리하기 전에 컨테이너·MongoDB 진단 정보를 남긴다.
- 브라우저의 trace·screenshot·HTML 결과는 `tests/web/_output/`에 있다. `pnpm run e2e:report`로 마지막 보고서를 연다.
- `apps/api/api-docs/_output/` 아래에서 실제 응답은 `logs/`, 실행 항목 요약은 `docs/summary.md`에 있다.
- benchmark는 `tests/api/benchmark/_output/<실행 시각>/`에 `report.html`과 `summary.json`을 남긴다. 측정용 극장 데이터는 DB에 남으며 `bash infra/reset.sh`로 초기화한다.

CI의 반복 실행 중 실패한 회차는 `[Run i/N]`에서 찾는다. API Race가 실패했다면 실행기의 진단 정보와 같은 시각의 컨테이너 로그를 함께 확인한다.

## 구조와 선택

API는 SoLA의 Gateway → View → Application → Core → Infrastructure 순서로 하위 계층에 의존한다. 필요한 하위 계층은 중간 계층을 거치지 않고 직접 호출할 수 있다. 같은 계층의 여러 모듈을 조합하는 작업은 상위 계층에서 맡는다. 단일 Core의 CRUD에는 Application 계층을 추가하지 않는다.

MongoDB는 데이터 저장과 트랜잭션, Redis는 좌석 선점과 리프레시 세션을 맡는다. NATS는 실시간 메시지를 전달하고, JetStream은 나중에 처리할 메시지를 보존하며, Restate는 중단된 작업을 재개한다. SDK 연결·호출은 common에, 업무 쿼리·정책·workflow 단계는 API에 구현한다. 선택 이유와 한계는 [설계 결정](docs/reference/decisions.md)에 있다.

| 위치             | 안내                                                     |
| ---------------- | -------------------------------------------------------- |
| `apps/`          | [모듈 경계, 업무 흐름, 인증과 DTO](docs/apps.md)         |
| `libs/`          | [공통화 기준과 공개 계약](docs/libs.md)                  |
| `tests/`         | [다중 프로세스·브라우저·성능 검증의 범위](docs/tests.md) |
| `infra/`         | [개발 인프라 구성과 reset의 범위](docs/infra.md)         |
| `tools/`         | [개발·테스트 실행 도구](docs/tools.md)                   |
| `.devcontainer/` | [개발 환경과 env 주입](docs/devcontainer.md)             |

작성 방법은 [개발 규칙](docs/reference/conventions.md), 변경과 리뷰의 판단 기준은 [프로젝트 변경·검토 기준](docs/reference/project-review.md)을 따른다. 할 일과 미결 검토는 루트 `_todo/`에서 관리한다.

## 운영 적용 범위

제공하는 인프라와 실행 구성은 개발·검증용이다. 운영 환경의 TLS·백업·모니터링·무중단 배포 구성은 포함하지 않는다.

- 데모에서 사용자 IP를 전달받도록 설정하려면 프록시가 실제 접속 IP를 넣고, 이를 우회한 직접 접속을 막아야 한다. [사용자 IP 전달 설정](docs/apps.md#데모와-bff)을 따른다.
- 진행 중인 구매·상영 작업이 있을 때 workflow 코드를 배포하려면 기존 작업이 끝날 때까지 이전 코드를 유지해야 한다. [진행 중인 작업을 보존하는 배포](docs/reference/decisions.md#배포-revision)를 따른다.
