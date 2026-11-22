# nest-seed

[English](README.en.md)

NestJS 백엔드 프로젝트를 위한 시작 템플릿이다. 사용자·파일·이벤트·비동기 작업 API와 가입·로그인 화면을 제공한다.

## 시작하기

인프라는 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(패키지 scope `@mannercode` 포함)를 바꾼다.

**Dev Container를 시작하거나 `pnpm run atoz`를 실행하면 이 프로젝트의 개발 데이터가 삭제된다.** [초기화 범위](infra/README.md#2-인프라-시작과-데이터-초기화)

1. Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 의존성 설치와 인프라 초기화가 끝날 때까지 기다린다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`로 API와 web을 실행한다. 같은 컨테이너의 다른 터미널에서 `curl "http://localhost:${API_PORT}/health"`로 API를 확인한다.
4. `echo "$WEB_PORT"`로 web의 포트 번호를 확인하고 VS Code 포트 패널에서 그 포트를 전달해 web을 연다.

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다. 전체 명령 목록은 `pnpm run`으로 확인한다.

| 명령                 | 용도                                             |
| -------------------- | ------------------------------------------------ |
| `pnpm run dev`       | API와 web을 watch mode로 실행                    |
| `pnpm run test`      | 단위·통합 테스트와 API 문서 예제 검증            |
| `pnpm run lint`      | 타입·코드·서식·셸·문서 링크 검사                 |
| `pnpm run format`    | Prettier로 저장소 전체의 서식 정리               |
| `pnpm run atoz`      | 실행 환경 초기화 후 CI 기본 검증                 |
| `pnpm run e2e`       | production build의 web과 API 연결 검증           |
| `pnpm run race`      | 다중 복제본 테스트의 시나리오 목록과 실행법 확인 |
| `pnpm run benchmark` | 같은 조건의 API 성능 비교                        |

실행 중인 API에서 curl 예제를 검증하려면 `bash apps/api/api-docs/run.sh`를 실행한다. 예제 파일명을 인자로 주면 해당 파일만 실행한다.

API 통합 테스트 한 파일만 실행하려면 라이브러리를 빌드한 뒤 파일명을 지정한다.

```bash
pnpm run pretest
pnpm --filter './apps/api' test users.spec --coverage.enabled=false
```

## 구조와 선택

| 위치                                      | 주요 내용                                              |
| ----------------------------------------- | ------------------------------------------------------ |
| [apps/api/](apps/api/README.md)           | 서비스 구성, SoLA 의존 방향, API 작성 규칙과 사용 예제 |
| [apps/web/](apps/web/)                    | 사진 첨부 가입·로그인·본인 조회 화면과 API 프록시      |
| [libs/](libs/README.md)                   | 공통 패키지의 책임과 사용 계약                         |
| [.devcontainer/](.devcontainer/README.md) | 루트 env 변경 후 컨테이너 재생성, 호스트 경로 공유     |
| [infra/](infra/README.md)                 | 개발 인프라 구성과 데이터 초기화                       |
| [tests/](tests/README.md)                 | 테스트 작성 규칙, 검증 범위와 브라우저 테스트 실행법   |
| [tools/](tools/README.md)                 | 웹 개발 서버 외부 접속과 테스트 도구                   |

저장소 작업과 리뷰의 기준은 [AGENTS.md](AGENTS.md)에 있다.
