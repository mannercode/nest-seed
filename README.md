# nest-seed

NestJS 기반 백엔드 프로젝트를 위한 시작 템플릿이다. `apps/api`에 사용자·파일·이벤트·비동기 작업 예제를, `apps/web`에 가입·로그인·본인 조회 화면을 둔다. `libs/`는 다른 NestJS 프로젝트에서도 사용하는 공통 코드다.

## 시작하기

제공하는 인프라와 실행 구성은 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(`@mannercode/*` 패키지 scope 포함)를 바꾼다.

지원하는 개발 환경은 Dev Container다. Docker가 있는 호스트의 저장소를 VS Code Remote SSH로 연다. 호스트와 컨테이너의 workspace 절대경로가 같아야 한다. 자세한 구성은 [개발 환경](.devcontainer/README.md)을 따른다.

1. VS Code에서 `Reopen in Container`를 실행한다. 의존성 설치와 인프라 초기화가 끝날 때까지 기다린다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`로 API와 web을 실행하고 `curl http://localhost:3000/health`로 확인한다.
4. VS Code 포트 패널에서 `3200`을 전달해 web을 연다. 자동 포트 전달은 꺼져 있다.

**Dev Container 시작, `bash infra/reset.sh`, `pnpm run atoz`는 MongoDB 데이터·S3 파일·Restate journal·JetStream 이벤트를 삭제한다.** 보존할 데이터나 진행 중인 작업이 있는 환경에서 실행하지 않는다.

루트 `.env.api`와 `.env.infra`는 커밋된 개발 설정이다. 파일을 수정하면 **`Rebuild Container`로 Dev Container를 다시 만든다.** 운영 secret은 저장소 밖에서 주입한다. [환경 변수 주입 방식](.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성)을 참고한다.

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다. 각 명령은 라이브러리 빌드 등 필요한 준비 단계를 포함한다.

| 명령                       | 용도                                                          |
| -------------------------- | ------------------------------------------------------------- |
| `pnpm run dev`             | API와 web을 watch mode로 실행                                 |
| `pnpm run test`            | workspace의 단위·통합 테스트                                  |
| `pnpm run lint`            | 타입·코드·서식·셸·문서 링크 검사                              |
| `pnpm run atoz`            | 인프라 초기화부터 빌드·테스트·브라우저·API 문서까지 전체 회귀 |
| `pnpm run api-docs`        | 복제본 4개의 API 스택에서 bash·curl 문서 검증                 |
| `pnpm run e2e`             | production build의 web과 API 연결 검증                        |
| `pnpm run race <scenario>` | 다중 복제본의 HTTP/SSE 경쟁·복제본 종료 검증                  |
| `pnpm run benchmark`       | 같은 조건의 API 성능 비교                                     |

race와 benchmark는 기본 test·AtoZ에 포함되지 않는다. 같은 API Vitest 명령을 동시에 여러 번 실행하는 것은 지원하지 않는다. 검사별 보장과 한계는 [테스트 가이드](tests/README.md)에 있다.

### 선택 실행과 외부 접속

특정 API spec만 실행할 때는 라이브러리를 빌드하고 부분 실행의 커버리지 수집을 끈다. 변경을 마칠 때는 해당 workspace의 전체 테스트와 커버리지 검사를 통과해야 한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

실행 중인 개발 API에 [curl 문서](apps/api/api-docs/)를 실행하려면 `bash apps/api/api-docs/run.sh`를 사용한다. 뒤에 `registration-photo.spec` 같은 파일명을 붙이면 해당 문서만 실행한다.

`pnpm run race`는 시나리오를, `pnpm run e2e:list`는 브라우저 테스트를 나열한다. `pnpm run e2e:ui`로 브라우저 테스트를 선택해 실행할 수 있다. Chromium 설치·버전 변경은 [개발 환경](.devcontainer/README.md#3-시작-순서와-데이터-초기화)을 따른다.

외부에서 web을 확인하려면 개발 서버를 실행한 뒤 다른 터미널에서 `pnpm exec tunnel`을 실행한다. cloudflared가 HTTPS Quick Tunnel 주소를 발급한다. [tunnel 사용 조건](tools/README.md#2-dev-tools--명시적으로-실행하는-개발-도구)을 참고한다.

### 결과와 진단

| 검사           | 결과 위치                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| 단위·통합·race | 터미널. race 실패 시 스택 정리 전에 컨테이너·MongoDB 진단 수집             |
| 브라우저       | `tests/web/_output/`의 trace·screenshot·HTML. `pnpm run e2e:report`로 열기 |
| curl 문서      | `apps/api/api-docs/_output/`의 `logs/`와 `docs/summary.md`                 |
| benchmark      | `tests/api/benchmark/_output/<실행 시각>/`의 `report.html`·`summary.json`  |

CI 반복 실행의 실패 회차는 `[Run i/N]`에서 찾는다. 스택 종료 후에도 측정 데이터는 남으며, 삭제하려면 [infra reset](infra/README.md#2-인프라-시작과-데이터-초기화)을 실행한다.

## 구조와 선택

| 위치                                      | 문서에서 다루는 내용                               |
| ----------------------------------------- | -------------------------------------------------- |
| [apps/](apps/README.md)                   | 시드의 범위, 가입·인증·이벤트·작업의 보장, web BFF |
| [apps/api/](apps/api/README.md)           | 서비스 구성, SoLA 의존 방향, API 작성 규칙         |
| [libs/](libs/README.md)                   | 공통 패키지의 책임과 사용 계약                     |
| [.devcontainer/](.devcontainer/README.md) | 개발 환경, env 적용, 호스트 경로 공유              |
| [infra/](infra/README.md)                 | 개발 인프라 구성과 데이터 초기화                   |
| [tests/](tests/README.md)                 | 테스트 작성 규칙과 검증 범위                       |
| [tools/](tools/README.md)                 | 개발·테스트 실행 도구                              |

저장소 작업과 리뷰의 기준은 [AGENTS.md](AGENTS.md)에 있다.
