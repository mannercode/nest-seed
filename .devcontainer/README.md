# .devcontainer/ — 개발 환경

Dev Container만 공식 개발 환경으로 지원한다. 앱·테스트·도구가 같은 버전의 MongoDB Replica Set·Redis Cluster·S3·NATS·Restate를 사용하고 Redis의 다중 키 제한 같은 분산 구성의 제약을 개발 중 확인하기 위해서다.

Node는 네이티브 Temporal을 사용하는 26 계열이다. TypeScript는 legacy compiler API를 쓰는 앱·도구의 호환성을 위해 사용처별로 버전을 고정한다.

## 1. 환경 변수 파일 변경 후 Dev Container 재생성

| 파일                                                | 역할·주입 시점                                      |
| --------------------------------------------------- | --------------------------------------------------- |
| [.env.infra](../.env.infra)                         | 인프라 접속·이미지·포트. Dev Container 생성 시 주입 |
| [.env.api](../.env.api)                             | 인증·HTTP·앱 설정. Dev Container 생성 시 주입       |
| [apps/web/.env](../apps/web/.env)                   | Next.js가 읽는 web 설정                             |
| [apps/api/api-docs/.env](../apps/api/api-docs/.env) | curl 문서 실행기가 읽는 셸 설정                     |

루트 env 파일을 바꾸면 **VS Code의 `Rebuild Container`로 Dev Container를 다시 만든다.** 앱·컨테이너 재시작만으로는 변경값이 반영되지 않는다. pnpm·앱·테스트·reset은 컨테이너의 환경 변수를 상속하고 루트 파일을 다시 읽지 않는다. API는 주입된 값을 검증한다. 검증용 API·web Compose는 루트 파일을 `env_file`의 `format: raw`로 전달한다.

루트 env 값에는 변수 치환이나 따옴표 제거가 적용되지 않는다. `API_URL=http://api:3000`처럼 최종 값을 적는다. `http://${API_HOST}:3000`의 변수는 치환되지 않으며 `PASSWORD="secret"`의 따옴표도 값이다. Compose YAML의 `${...}` 치환은 별개다.

공통 env에 `NODE_ENV`를 고정하지 않는다. 개발 명령·검증 스택·Next.js·Vitest가 실행 모드에 맞게 정한다. `WORKSPACE_ROOT`는 저장소 절대경로, `COMPOSE_PROJECT_NAME`은 Docker 프로젝트, `DEVCONTAINER_NETWORK`는 Compose 간 공유 네트워크다.

## 2. 호스트와 Dev Container에서 같은 경로 사용

Docker CLI가 호스트 소켓을 사용하므로 bind mount 경로를 찾는 쪽은 호스트다. workspace는 **호스트와 Dev Container에서 같은 절대경로**여야 한다. 예를 들어 호스트 `/home/me/project`를 컨테이너 `/workspaces/project`로 옮기면 Compose는 호스트에도 `/workspaces/project`가 있다고 가정하게 된다.

VS Code Remote SSH로 호스트 폴더를 열고 `Reopen in Container`를 사용한다. `Clone Repository in Container Volume`은 지원하지 않는다. 호스트의 `initializeCommand`가 만든 네트워크를 Dev Container와 Compose가 공유한다. 같은 사용자가 여러 저장소를 동시에 열 때는 컨테이너·네트워크 이름이 겹치지 않도록 폴더 이름을 다르게 둔다.

## 3. 시작 순서와 데이터 초기화

`postStartCommand`는 의존성 설치 → lockfile 버전의 Chromium 설치 → [infra reset](../infra/README.md#2-인프라-시작과-데이터-초기화) 순서로 준비한다. **Dev Container를 시작할 때마다 MongoDB·S3·Restate journal·JetStream 기록이 삭제된다.** 준비가 끝난 뒤 앱을 실행하며 보존할 데이터·작업이 있는 환경에 이 절차를 적용하지 않는다.

프로젝트 의존성은 workspace bind mount가 이미지의 같은 경로를 가리므로 이미지에 미리 설치하지 않는다. 브라우저용 OS 패키지는 이미지에 설치한다. Playwright 버전을 바꾸면 Dev Container를 다시 빌드해 OS 패키지와 Chromium을 맞춘다. Chromium만 다시 설치하려면 다음 명령을 실행한다. AtoZ도 Chromium 설치를 포함한다.

```bash
pnpm --filter './tests/web' exec playwright install chromium
```

자동 포트 전달은 꺼져 있다. web은 VS Code 포트 패널에서 전달한다.

## 4. 호스트 파일과 Docker 소켓 공유

Codex의 세션·인덱스·SQLite 상태는 프로젝트별 홈에, 설정·인증·스킬은 호스트 공용 홈에 둔다. 저장 시 교체되는 설정·인증 파일을 공유하려고 파일 대신 디렉터리를 마운트해 링크한다. 이 구성은 상태를 분리하며 파일 접근 샌드박스는 아니다.

호스트 Docker 소켓과 개발 도구 자격증명을 공유하므로 신뢰하지 않는 코드를 실행하기 전에 `.devcontainer/`·설치 스크립트·워크플로·셸 변경을 확인한다. 의존성 설치 스크립트 허용 목록은 [pnpm-workspace.yaml](../pnpm-workspace.yaml)에서 관리한다. 갱신 시 스크립트와 lockfile integrity를 확인하고 현재 OS에서 사용하지 않는 다른 OS 항목도 유지한다.
