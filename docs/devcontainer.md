# .devcontainer/ — 개발 환경

공식 개발 경로는 Dev Container 하나다. 로컬 직접 실행은 지원하지 않는다 — 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로).

## 환경 변수는 여기서 주입된다

`devcontainer.json`의 `runArgs`가 `.env.infra`와 `.env.api`를 `--env-file`로 컨테이너에 넣는다. 그래서 컨테이너 안의 모든 프로세스(dev 서버, 테스트, pnpm 스크립트)는 이 값들을 이미 주입된 `process.env`로 받는다. 앱은 `.env` 파일을 직접 읽지 않는다(`ignoreEnvFile`) — `--env-file`은 이미지 빌드가 아니라 컨테이너를 만들 때 한 번만 읽으므로, env 파일을 고친 뒤에는 컨테이너를 재생성(Rebuild Container)해야 반영된다. 단순 재시작(`docker restart`)으로는 옛 값이 그대로 남는다. 값의 전체 흐름은 [환경 변수](reference/environment.md)에 있다.

`containerEnv`는 두 값을 더 정의한다.

- `WORKSPACE_ROOT` — 저장소 루트의 절대 경로. 스크립트들이 `${WORKSPACE_ROOT:?}`로 받아 위치에 상관없이 저장소 파일을 가리킨다.
- `COMPOSE_PROJECT_NAME` — `${localEnv:USER:unknown}-${localWorkspaceFolderBasename}` 값. infra와 deploy compose가 공유하는 Docker 네트워크의 이름이 된다. 같은 사용자가 같은 basename의 clone을 동시에 열면 이름이 충돌하므로 서로 다른 폴더 이름을 사용한다.

## 컨테이너 안의 `docker` 명령은 호스트 Docker가 실행한다 (DooD)

devcontainer 안에는 Docker 데몬이 없다. `docker-outside-of-docker` feature가 표준 rootful Docker 소켓(`/var/run/docker.sock`)을 컨테이너에 연결해 주므로, 안에서 `docker compose up`을 실행하면 컨테이너를 실제로 만드는 쪽은 호스트 Docker다. 현재 구성은 Compose v2의 `docker compose`만 사용한다. feature의 `dockerDashComposeVersion`을 `none`으로 지정해 같은 기능의 legacy `docker-compose` 실행 파일은 별도로 설치하지 않는다.

여기서 경로 문제가 생긴다. compose가 데몬에 넘기는 파일 경로는 devcontainer 안에서 계산되는데, 그 경로로 파일을 여는 쪽은 호스트다. 두 경로가 다르면 호스트 Docker는 파일을 찾지 못한다. 그래서 `workspaceMount`는 작업 폴더를 **호스트와 같은 절대 경로**에 마운트하고, `workspaceFolder`는 VS Code가 그 경로를 작업 폴더로 열게 한다. 두 설정의 역할은 서로 다르므로 함께 둔다.

이 경로는 Remote SSH로 원격 저장소 폴더를 먼저 연 뒤 `Reopen in Container`를 실행하는 방식을 지원한다. VS Code의 `Clone Repository in Container Volume` 흐름에는 `${localWorkspaceFolder}`가 없으므로 현재 구성의 지원 대상이 아니다.

Dev Container·PlantUML·infra·deploy는 사용자명과 workspace basename으로 구분한 Docker 네트워크 하나에 함께 붙는다. Dev Container는 생성될 때부터 이 네트워크가 필요하므로, 호스트에서 먼저 실행되는 `initializeCommand`가 네트워크가 없을 때만 만든다. `runArgs`의 `--network`가 Dev Container를 연결하고, 모든 Compose 파일은 같은 이름의 기존 네트워크를 `external`로 참조한다. 별도 네트워크나 사후 `docker network connect`는 사용하지 않는다.

`compose.plantuml.yml`은 VS Code 개발 환경만을 위한 자원이므로 `.devcontainer/`에 둔다. 컨테이너 안의 `postStartCommand`가 `docker compose up -d`로 선언을 맞춘다. `COMPOSE_PROJECT_NAME`은 이미 `containerEnv`로 전달되므로 명령에서 프로젝트명을 다시 만들지 않는다. 애플리케이션과 테스트가 소비하며 `infra/reset.sh`로 초기화하는 프로젝트별 인프라에는 포함하지 않는다. Dev Container 자체는 단일 컨테이너 설정(`build`와 `runArgs`)으로 실행한다.

## 부팅 순서

1. `initializeCommand` — 공유 프로젝트 네트워크가 없으면 만들고 호스트의 도구 설정 디렉터리 준비
2. 이미지 빌드 — patch·배포판·digest까지 고정한 Node 베이스에 개발 도구를 설치한다. cloudflared는 Cloudflare의 서명된 APT 저장소에서 설치한다. 베이스 이미지에는 pnpm과 Corepack이 없으므로 npm으로 pnpm을 전역 설치한다. 이 전역 설치본은 bootstrap 역할만 하며, workspace 안에서는 루트 `package.json`의 `packageManager`가 지정한 정확한 pnpm 버전을 자동으로 내려받아 실행한다. Dockerfile의 `RUN`은 root로 실행되어 `sudo`가 필요 없고, 실행 중인 `node` 사용자에게 npm용 sudo 권한을 주지 않는다. 설치 명령의 실패가 빌드를 중단하므로 별도 `--version` 출력으로 다시 확인하지 않는다. k6와 Playwright 브라우저는 이미지에 설치하지 않고 각 테스트를 실행할 때 공식 Docker 이미지를 사용한다([tests 문서](tests.md)).
3. `postStartCommand` — `pnpm install --frozen-lockfile`로 워크스페이스 의존성을 맞추고, PlantUML과 개발 인프라를 기동한다. 세 명령은 서로 독립적이므로 병렬로 실행되며, manifest와 lockfile이 다르거나 어느 하나라도 실패하면 연결 준비가 실패한다.

첫 부팅은 Dev Container 빌드와 PlantUML·인프라 이미지 다운로드 때문에 시간이 걸린다. 이후 부팅은 인프라 리셋 시간(약 30초)이 대부분이다.

Playwright와 Chromium은 Dev Container에 설치하지 않는다. web e2e가 필요할 때만 브라우저와 OS 의존성이 든 공식 Playwright 이미지를 받고, 테스트 package는 그 전용 이미지에 `npm ci`로 설치한다. 따라서 첫 Dev Container 부팅은 브라우저 다운로드와 무관하다. 워크스페이스 의존성은 bind mount된 작업 트리에 있어야 하므로 image에 넣지 않고 `postStartCommand`에서 복원한다. image에 설치하면 실행 시 workspace mount에 가려진다. 이 명령은 기존 컨테이너를 시작하거나 다시 연결할 때도 실행되지만, lockfile과 `node_modules`가 그대로면 pnpm이 변경할 내용 없이 끝난다.

PlantUML 이미지는 version tag와 multi-architecture digest를 같이 고정한다. 호스트 port를 publish하거나 VS Code로 forward하지 않는다. Remote extension host에서 실행되는 PlantUML 확장이 `http://plantuml:8080`으로 서버를 호출하고, 받은 이미지를 data URL로 전용 Preview에 넣으므로 Docker 네트워크만으로 충분하다. Markdown 파일에서 커서를 다이어그램 안에 두고 `PlantUML: Preview Current Diagram`(`Alt+D`, macOS는 `Option+D`)을 실행한다.

PlantUML 컨테이너 이름은 `${USER}-${localWorkspaceFolderBasename}-plantuml`, 네트워크 이름은 Dev Container와 같은 `${USER}-${localWorkspaceFolderBasename}`이다. `plantuml`은 이 네트워크 안의 service DNS 이름이다. image pin이 바뀌면 다음 `postStartCommand`의 `up -d`가 해당 작업 폴더의 컨테이너만 새 선언으로 교체한다.

VS Code의 내장 Markdown 전체 Preview는 이 구성의 지원 대상이 아니다. PlantUML 확장의 Markdown 연동은 HTML에 `http://plantuml:8080` 이미지 주소를 넣는데, local machine의 webview는 Docker DNS 이름 `plantuml`을 해석할 수 없다. 전체 Preview까지 지원하려면 local machine으로 이어지는 별도 port forwarding과 접근 경로가 필요하다. 한 기능을 위해 실행 경로를 둘로 늘리지 않고 전용 Preview 하나를 공식 경로로 정한다.

pnpm store는 bind mount된 workspace의 `.pnpm-store`에 둔다. clone마다 디스크를 더 쓰는 대신 컨테이너를 다시 만들어도 같은 clone의 다운로드 캐시가 남고, 호스트별 별도 mount 설정이 필요 없다. 용량을 회수하려면 컨테이너를 정지한 뒤 이 디렉터리만 지울 수 있지만, 다음 설치에서 패키지를 다시 내려받는다.

Dev Container의 Node 이미지는 프로젝트 호환성과 재현성을 위해 patch·배포판·digest까지 API·프런트엔드 이미지와 동일하게 고정하고, Dependabot이 참조들의 minor/patch 갱신을 한 PR로 묶는다. 나머지 개발 도구는 이미지를 다시 빌드할 때 현재 릴리스를 받는다. 프로젝트 의존성은 pnpm manifest와 lockfile이 관리한다. Playwright runner의 package 버전은 `tests/web/package.json`·`package-lock.json`과 공식 이미지 tag를 같은 값으로 맞추고 구성 계약 테스트로 어긋남을 막는다.

프로젝트 네트워크·PlantUML·개발 인프라 컨테이너·volume 이름은 사용자명과 workspace basename으로 구분한다. 같은 basename의 clone은 프로젝트 자원 이름이 겹치므로, 같은 호스트에서 두 clone을 동시에 띄울 때는 서로 다른 폴더 이름을 사용한다. 개발 인프라와 PlantUML은 host 포트를 publish하지 않는다. 선택 기능인 VersityGW Admin API와 WebUI도 활성화하지 않아 Dev Container를 추가로 띄워도 host port 때문에 부팅이 실패하지 않는다.

## 호스트 자격증명 마운트

기본 `devcontainer.json`은 호스트의 `~/.config/gh`, `~/.codex`, `~/.claude`, `~/.claude.json`을 컨테이너에 bind mount한다. 개발 도구 로그인을 재사용하기 위한 설정이지만, 컨테이너 안의 프로세스가 해당 자격증명에 접근할 수 있다는 뜻이다.

하지만 Dev Container는 호스트 Docker socket을 연결하므로 sandbox나 보안 경계가 아니다. 악성 스크립트는 Docker로 호스트 경로를 새로 마운트할 수 있다. 외부 PR처럼 신뢰하지 않는 revision은 컨테이너를 시작하기 **전에 호스트에서** `.devcontainer/`, 의존성 lifecycle script, workflow·shell 변경과 전체 diff를 먼저 검토한다.

신뢰하는 저장소·커밋에서만 컨테이너를 열고 최소 권한·짧은 만료 토큰을 쓴다. 마운트가 필요하지 않은 도구는 개인 Dev Container override에서 제거할 수 있다.

## 의존성 설치 스크립트 승인

pnpm 11의 `strictDepBuilds: true`를 사용한다. 의존성이 실행하는 `preinstall`·`install`·`postinstall`은 `pnpm-workspace.yaml`의 `allowBuilds`에서 정확한 버전에 `true`로 승인한 경우에만 실행되고, `false`는 의도적으로 차단한다. 목록에 없는 새 빌드 스크립트는 설치를 실패시킨다.

패키지를 올린 뒤에는 `pnpm ignored-builds`로 차단된 항목을 확인하고 실제 lifecycle script와 lockfile integrity를 검토한다. 승인할 항목은 `pnpm approve-builds`로 반영하되, 최종 `allowBuilds`가 정확한 버전만 허용하는지 확인한다. `fsevents`처럼 다른 OS에서만 필요한 승인도 있으므로 현재 OS의 출력만 보고 기존 항목을 지우지 않는다.
