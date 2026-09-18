# .devcontainer/ — 개발 환경

공식 개발 경로는 Dev Container 하나다. MongoDB Replica Set·Redis Cluster·NATS·Restate를 같은 구성으로 실행해 환경별 차이를 줄인다. 로컬 직접 실행을 병행 지원하는 대신 컨테이너 안의 앱·테스트·실행 도구가 같은 환경을 사용한다.

## 1. 환경 변수는 재생성해야 반영된다

루트 [.env.infra](../.env.infra)는 인프라 접속·이미지·포트와 개발 admin을, [.env.api](../.env.api)는 인증·HTTP·업무 설정을 소유한다. 두 파일은 Dev Container를 **만들 때** 주입되고 pnpm·앱·테스트가 상속한다. 수정한 뒤 앱이나 컨테이너를 재시작하는 것만으로는 주입 값이 바뀌지 않는다. **Rebuild Container로 재생성한다.**

API는 별도 env 파일을 찾지 않고 주입된 값을 검증한다. reset·API 테스트 실행기 역시 루트 env 파일을 shell로 다시 읽지 않는다. API/web Compose가 새 앱 컨테이너에 전달할 때는 `env_file`의 `format: raw`를 사용한다.

이 경로에서 `$`와 따옴표는 값의 일부다. shell 문법처럼 다른 변수를 참조하거나 값을 따옴표로 감싸지 않는다.

```dotenv
# 의도한 최종 값을 적는다.
API_URL=http://api:3000
PASSWORD=secret
```

`API_URL=http://${API_HOST}:3000`은 변수를 치환하지 않으며 `PASSWORD="secret"`은 따옴표까지 전달한다. Compose YAML 자체의 `${...}` 보간은 이 파일 주입과 별개다. 두 frontend의 `.env`는 Next.js가 읽고, `apps/api/api-docs/.env`는 문서 실행기가 읽는 shell 설정이다.

공통 env 파일에는 `NODE_ENV`를 고정하지 않는다. 개발 진입점·검증 스택·Next.js·Vitest가 자신의 실행 모드를 정한다. `WORKSPACE_ROOT`는 저장소 절대경로, `COMPOSE_PROJECT_NAME`은 Docker 프로젝트 이름, `DEVCONTAINER_NETWORK`는 여러 프로젝트가 공유하는 네트워크 이름이다.

## 2. Docker-outside-of-Docker의 경로 계약

컨테이너의 Docker CLI는 호스트 Docker socket을 사용한다. bind mount의 source를 여는 주체도 호스트이므로 workspace는 호스트와 Dev Container에서 **같은 절대경로**여야 한다.

```text
호스트 /home/me/project ↔ 컨테이너 /home/me/project       가능
호스트 /home/me/project ↔ 컨테이너 /workspaces/project   불가
```

두 번째 구성에서 Compose가 `/workspaces/project`를 mount source로 넘기면 호스트 daemon도 호스트의 그 경로를 찾는다. 따라서 VS Code Remote SSH로 호스트 폴더를 연 뒤 `Reopen in Container`를 사용하는 경로만 지원한다. `Clone Repository in Container Volume`은 지원하지 않는다.

호스트의 `initializeCommand`가 네트워크를 먼저 만들고 Dev Container와 Compose가 이를 공유한다. 같은 사용자로 basename이 같은 clone을 동시에 열면 컨테이너·네트워크 이름이 충돌하므로 폴더 이름을 다르게 둔다.

## 3. 시작 순서와 데이터 수명

의존성 설치 → lockfile 버전의 Chromium 설치 → [인프라 reset](infra.md#2-시작과-reset의-범위)이 순서대로 끝나야 준비가 완료된다. 설치와 앱 실행을 병렬로 시작하지 않는다. workspace bind mount에 가려질 프로젝트 의존성은 이미지에 미리 설치하지 않는다.

브라우저의 OS 의존성은 이미지 빌드에서 준비한다. Playwright 버전을 변경하면 Dev Container도 다시 빌드해 Chromium·OS 의존성을 맞춘다.

**postStartCommand는 매 시작에 개발 데이터를 초기화한다.** DB·S3 객체뿐 아니라 Restate journal과 JetStream 기록도 지운다. 보존할 데이터나 실행이 있는 환경에는 이 시작 절차를 적용하지 않는다.

자동 포트 전달은 꺼져 있다. 브라우저에서 console·user-app을 열 때 VS Code 포트 패널에서 frontend 포트를 전달한다. 컨테이너 터미널의 `localhost`는 컨테이너 자신이다.

## 4. 개발 도구와 호스트의 경계

Codex의 세션·인덱스·SQLite 상태는 프로젝트별 홈에 두고 설정·인증·스킬만 호스트의 공용 홈에서 링크한다. 교체 저장되는 설정·인증 파일을 개별 bind mount하지 않고 디렉터리를 마운트한다. 이는 상태 분리이며 파일 접근을 차단하는 sandbox는 아니다.

Docker socket과 개발 도구 자격증명을 마운트하므로 신뢰하지 않는 revision을 실행하기 전에는 `.devcontainer/`, 설치 script, workflow·shell 변경을 확인한다. 의존성 설치 script의 허용 목록은 [pnpm-workspace.yaml](../pnpm-workspace.yaml)이 소유한다. 갱신 시 script 내용과 lockfile integrity를 확인하고, 현재 OS에서 실행되지 않는다는 이유만으로 다른 OS용 항목을 지우지 않는다.
