# nest-seed

[English](README.en.md)

NestJS 백엔드 프로젝트를 위한 시작 템플릿이다. 사용자·파일·이벤트·비동기 작업 API와 가입·로그인 화면을 제공한다.

## 시작하기

인프라는 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(패키지 scope `@mannercode` 포함)를 바꾼다.

**Dev Container를 시작하면 이 프로젝트의 개발 데이터가 삭제된다.** [초기화 범위](infra/README.md#2-인프라-시작과-데이터-초기화)

1. Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 의존성 설치와 인프라 초기화가 끝날 때까지 기다린다.
2. 컨테이너 터미널에서 `pnpm run lint`와 `pnpm test`를 실행한다.
3. `pnpm run dev`로 API와 web을 실행한다. 같은 컨테이너의 다른 터미널에서 `curl "http://localhost:${API_PORT}/health"`로 API를 확인한다.
4. `echo "$WEB_PORT"`로 web의 포트 번호를 확인하고 VS Code 포트 패널에서 그 포트를 전달해 web을 연다.

### 환경 변수 파일 변경 후 Dev Container 재생성

Dev Container는 생성할 때 루트의 `.env.infra`와 `.env.api`를 읽는다. 둘 중 하나를 수정하면 VS Code에서 **`Rebuild Container`**를 실행한다. `.env.infra`의 `API_PORT`를 바꾸면 web 개발 서버의 `API_BASE_URL`도 새 포트에 맞춘다. [웹 설정](apps/web/.env)

Compose도 API 컨테이너를 만들 때 두 파일을 그대로 읽는다. 변수 참조와 따옴표가 값에 포함되므로 `API_PORT=3000`처럼 최종 값을 적는다. `NODE_ENV`는 개발 서버와 테스트가 각각 설정한다. [API Compose 설정](infra/compose.apps.yml)

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다. 루트 명령은 `pnpm run`, 웹 앱 명령은 `pnpm -C apps/web run`으로 확인한다.

| 명령                          | 용도                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `pnpm run dev`                | API와 web을 watch mode로 실행                                |
| `pnpm test`                   | 단위·통합·API 예제·브라우저 E2E 테스트 (Restate 재시작 포함) |
| `pnpm run lint`               | 타입·코드·서식·셸·문서 링크 검사                             |
| `pnpm run format`             | Prettier로 저장소 전체의 서식 정리                           |
| `pnpm -C apps/web test`       | production build의 web과 API 연결 검증                       |
| `pnpm -C infra run race`      | 다중 복제본 테스트의 시나리오 목록과 실행법 확인             |
| `pnpm -C infra run benchmark` | 같은 조건의 API 성능 비교                                    |

개발 인프라가 실행 중일 때 `pnpm -C infra run apps:up`으로 API 한 개와 web을 띄운다. 명령 끝에 `api`를 붙이면 API 한 개만, `nginx`를 붙이면 NGINX와 API 복제본 4개를 띄운다. 수동으로 구성을 바꿀 때는 `pnpm -C infra run apps:down`으로 이전 앱을 먼저 내린다. API 문서 테스트, 웹 E2E, race, benchmark는 이전 앱을 내린 뒤 테스트 구성을 띄운다. [앱 Compose](infra/compose.apps.yml)

실행 중인 개발 서버에서 curl 예제를 검증하려면 `bash apps/api/api-docs/run.sh`를 실행한다. 단일 API 컨테이너를 대상으로 할 때는 `SERVER_URL="http://api:${API_PORT:?}" bash apps/api/api-docs/run.sh`를 사용한다. 예제 파일명을 인자로 주면 해당 파일만 실행한다.

API 통합 테스트 한 파일만 실행하려면 라이브러리를 빌드한 뒤 파일명을 지정한다.

```bash
pnpm run pretest
pnpm --dir apps/api exec vitest run users.spec
```

## 프로젝트 태스크

- `mannercode/nest-seed`에서 할 일이 정해지면 같은 작업의 태스크를 찾고, 없으면 요청받은 내용으로 `Todo`에 등록한다. [프로젝트 보드](https://github.com/orgs/mannercode/projects/2/views/1)
- 작업을 시작하면 태스크를 `Progress`로 옮긴다. 주요 결정과 이유, 막힌 점, 검증 결과를 태스크에 기록하고 PR을 열면 링크를 추가한다.
- 해당 PR이 `main`에 병합된 것을 확인한 뒤 태스크를 `Done`으로 옮긴다.

## 구조와 선택

| 위치                                              | 주요 내용                                              |
| ------------------------------------------------- | ------------------------------------------------------ |
| [apps/api/](apps/api/README.md)                   | 서비스 구성, SoLA 의존 방향, API 작성 규칙과 사용 예제 |
| [apps/web/](apps/web/README.md)                   | 사진 첨부 가입·로그인·본인 조회, API 프록시와 E2E      |
| [libs/](libs/README.md)                           | 공통 패키지의 책임과 사용 계약                         |
| [.devcontainer/](.devcontainer/devcontainer.json) | Dev Container 시작 명령과 VS Code 설정                 |
| [infra/](infra/README.md)                         | 앱 컨테이너 실행, 개발 인프라 초기화와 복제본 검증     |
| [tools/](tools/README.md)                         | 웹 개발 서버 외부 접속과 테스트 도구                   |

저장소 작업·테스트 작성·리뷰 기준은 [AGENTS.md](AGENTS.md)에 있다.
