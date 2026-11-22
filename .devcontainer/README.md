# .devcontainer/ — 개발 환경

개발과 CI가 같은 도구를 사용하도록 Node·pnpm·Docker CLI를 Dev Container에 설치한다. 데이터베이스와 메시지 서버는 [개발 인프라](../infra/README.md)에서 실행한다.

## 1. 환경 변수 파일 변경 후 Dev Container 재생성

| 파일                                                | 역할·주입 시점                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| [.env.infra](../.env.infra)                         | 인프라 접속·이미지·포트. Dev Container 생성 시 주입                |
| [.env.api](../.env.api)                             | 인증·HTTP·앱 설정. Dev Container 생성 시 주입                      |
| [apps/web/.env](../apps/web/.env)                   | Next.js가 호출할 API 주소. API 포트를 바꾸면 `API_BASE_URL`도 변경 |
| [apps/api/api-docs/.env](../apps/api/api-docs/.env) | curl 문서 실행기가 읽는 셸 설정                                    |

루트의 두 파일을 바꾸면 **VS Code에서 `Rebuild Container`를 실행한다.** Dev Container 안에서 시작한 앱과 셸 명령은 컨테이너를 만들 때 받은 값을 상속한다. 검증용 Compose는 API 컨테이너를 만들 때 같은 파일을 `env_file`의 `format: raw`로 읽는다.

루트 env 값에는 변수 치환이나 따옴표 제거가 적용되지 않는다. `API_URL=http://api:3000`처럼 최종 값을 적는다. `http://${API_HOST}:3000`의 변수는 치환되지 않으며 `PASSWORD="secret"`의 따옴표도 값이다. Compose YAML의 `${...}` 치환은 별개다.

개발 서버와 테스트가 각각 실행 모드를 정하므로 루트 env 파일에서는 `NODE_ENV`를 설정하지 않는다.

## 2. 호스트와 Dev Container에서 같은 경로 사용

Docker CLI가 호스트 소켓을 사용하므로 bind mount 경로를 찾는 쪽은 호스트다. workspace는 **호스트와 Dev Container에서 같은 절대경로**여야 한다. 예를 들어 호스트 `/home/me/project`를 컨테이너 `/workspaces/project`로 옮기면 Compose는 호스트에도 `/workspaces/project`가 있다고 가정하게 된다.

VS Code Remote SSH로 호스트 폴더를 열고 `Reopen in Container`를 사용한다. `Clone Repository in Container Volume`은 지원하지 않는다. 호스트의 `initializeCommand`가 만든 네트워크를 Dev Container와 Compose가 공유한다. 같은 사용자가 여러 저장소를 동시에 열 때는 컨테이너·네트워크 이름이 겹치지 않도록 폴더 이름을 다르게 둔다.

## 3. 시작 순서와 데이터 초기화

VS Code는 새 Dev Container를 만들 때 `node` 계정으로 `hunjuly/dotfiles`의 `install.sh`를 실행한다. 포크할 때는 `devcontainer.json`의 `dotfiles.repository`를 사용할 저장소로 바꾸거나 제거한다.

Dev Container를 시작할 때마다 `postStartCommand`가 workspace에 의존성을 설치하고 개발 데이터를 삭제한 뒤 인프라를 다시 만든다. 삭제되는 데이터와 준비 완료 조건은 [인프라 초기화](../infra/README.md#2-인프라-시작과-데이터-초기화)에 있다.
