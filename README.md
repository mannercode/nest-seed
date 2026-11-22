# nest-seed

[English](README.en.md)

NestJS 기반 백엔드 프로젝트를 위한 시작 템플릿이다. `apps/api`에 사용자·파일·이벤트·비동기 작업 예제를, `apps/web`에 가입·로그인·본인 조회 화면을 둔다. `libs/`는 다른 NestJS 프로젝트에서도 사용하는 공통 코드다.

## 시작하기

제공하는 인프라와 실행 구성은 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(`@mannercode/*` 패키지 scope 포함)를 바꾼다.

지원하는 개발 환경은 Dev Container다. Docker가 있는 호스트의 저장소를 VS Code Remote SSH로 연다. 호스트와 컨테이너의 workspace 절대경로가 같아야 한다. 자세한 구성은 [개발 환경](.devcontainer/README.md)을 따른다.

**Dev Container는 시작할 때마다 이 프로젝트의 개발 인프라를 초기화한다.** 저장된 계정·세션·업로드 파일·이벤트와 진행 중인 작업이 삭제된다. `pnpm run atoz`도 같은 [초기화 스크립트](infra/README.md#2-인프라-시작과-데이터-초기화)를 실행한다.

1. VS Code에서 `Reopen in Container`를 실행한다. 의존성 설치와 인프라 초기화가 끝날 때까지 기다린다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`로 API와 web을 실행한다. 다른 컨테이너 터미널에서 `curl "http://localhost:${API_PORT}/health"`로 API를 확인한다.
4. `echo "$WEB_PORT"`로 web의 포트 번호를 확인하고 VS Code 포트 패널에서 그 포트를 전달해 web을 연다.

루트의 `.env.api`나 `.env.infra`를 수정하면 VS Code에서 `Rebuild Container`를 실행한다. [환경 변수 적용 방법](.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성)

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다. 전체 명령 목록은 `pnpm run`으로 확인한다.

| 명령                 | 용도                                             |
| -------------------- | ------------------------------------------------ |
| `pnpm run dev`       | API와 web을 watch mode로 실행                    |
| `pnpm run test`      | workspace의 단위·통합 테스트                     |
| `pnpm run lint`      | 타입·코드·서식·셸·문서 링크 검사                 |
| `pnpm run format`    | Prettier로 저장소 전체의 서식 정리               |
| `pnpm run atoz`      | 실행 환경 초기화 후 CI 기본 검증                 |
| `pnpm run api-docs`  | curl로 API 사용 예제를 실행하고 응답 확인        |
| `pnpm run e2e`       | production build의 web과 API 연결 검증           |
| `pnpm run race`      | 다중 복제본 테스트의 시나리오 목록과 실행법 확인 |
| `pnpm run benchmark` | 같은 조건의 API 성능 비교                        |

서식만 검사하려면 `pnpm run lint:format`을 실행한다. [테스트별 검증 범위](tests/README.md#검증-범위)

### 선택 실행과 외부 접속

API 통합 테스트 한 파일을 실행하려면 라이브러리를 빌드한 뒤 Vitest에 파일명을 넘긴다. 전체 커버리지는 `pnpm run test`로 확인한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

개발 API가 실행 중이면 `bash apps/api/api-docs/run.sh`로 사용 예제를 실행한다. 뒤에 `users.spec` 같은 파일명을 붙이면 해당 예제만 실행한다. [API 사용 예제](apps/api/README.md#실행-가능한-api-문서)

브라우저 테스트 목록은 `pnpm run e2e:list`로 확인하고 실행 결과는 `pnpm run e2e:report`로 연다. 테스트를 선택해 실행하려면 `pnpm run e2e:ui`를 실행하고 VS Code 포트 패널에서 `e2e:<출력된 UI 포트>`를 전달한다. [브라우저 E2E 실행 환경](tests/README.md#브라우저-e2e)

외부에서 web을 확인하려면 개발 서버를 실행한 뒤 다른 터미널에서 `pnpm exec tunnel`을 실행한다. cloudflared가 HTTPS Quick Tunnel 주소를 발급한다. [tunnel 사용 조건](tools/README.md#2-dev-tools--명시적으로-실행하는-개발-도구)을 참고한다.

## 구조와 선택

| 위치                                      | 주요 내용                                              |
| ----------------------------------------- | ------------------------------------------------------ |
| [apps/api/](apps/api/README.md)           | 서비스 구성, SoLA 의존 방향, API 작성 규칙과 사용 예제 |
| [apps/web/](apps/web/)                    | 사진 첨부 가입·로그인·본인 조회 화면과 API 프록시      |
| [libs/](libs/README.md)                   | 공통 패키지의 책임과 사용 계약                         |
| [.devcontainer/](.devcontainer/README.md) | 개발 환경, env 적용, 호스트 경로 공유                  |
| [infra/](infra/README.md)                 | 개발 인프라 구성과 데이터 초기화                       |
| [tests/](tests/README.md)                 | 테스트 작성 규칙과 검증 범위                           |
| [tools/](tools/README.md)                 | 개발·테스트 실행 도구                                  |

저장소 작업과 리뷰의 기준은 [AGENTS.md](AGENTS.md)에 있다.
