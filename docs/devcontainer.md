# .devcontainer/ — 개발 환경

공식 개발 경로는 Dev Container 하나다. 로컬 직접 실행은 지원하지 않는다 — 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로).

## 환경 변수는 여기서 주입된다

`devcontainer.json`의 `runArgs`가 `.env.infra`와 `.env.api`를 `--env-file`로 컨테이너에 넣는다. 그래서 컨테이너 안의 모든 프로세스(dev 서버, 테스트, npm 스크립트)는 이 값들을 이미 주입된 `process.env`로 받는다. 앱은 `.env` 파일을 직접 읽지 않는다(`ignoreEnvFile`) — `--env-file`은 컨테이너를 만들 때 한 번만 읽으므로, env 파일을 고친 뒤에는 컨테이너를 재생성(Rebuild Container)해야 반영된다. 단순 재시작(`docker restart`)으로는 옛 값이 그대로 남는다. 값의 전체 흐름은 [환경 변수](reference/environment.md)에 있다.

`containerEnv`는 두 값을 더 정의한다.

- `WORKSPACE_ROOT` — 저장소 루트의 절대 경로. 스크립트들이 `${WORKSPACE_ROOT:?}`로 받아 위치에 상관없이 저장소 파일을 가리킨다.
- `COMPOSE_PROJECT_NAME` — `${localEnv:USER:unknown}-${localWorkspaceFolderBasename}` 값. infra와 deploy compose가 공유하는 Docker 네트워크의 이름이 된다. 같은 사용자가 같은 basename의 clone을 동시에 열면 이름이 충돌하므로 서로 다른 폴더 이름을 사용한다.

## 컨테이너 안의 `docker` 명령은 호스트 Docker가 실행한다 (DooD)

devcontainer 안에는 Docker 데몬이 없다. `docker-outside-of-docker` feature가 호스트의 Docker 소켓을 컨테이너에 연결해 주므로, 안에서 `docker compose up`을 실행하면 컨테이너를 실제로 만드는 쪽은 호스트 Docker다.

여기서 경로 문제가 생긴다. compose가 데몬에 넘기는 파일 경로는 devcontainer 안에서 계산되는데, 그 경로로 파일을 여는 쪽은 호스트다. 두 경로가 다르면 호스트 Docker는 파일을 찾지 못한다. 그래서 `workspaceMount`가 작업 폴더를 **호스트와 같은 경로**로 마운트한다.

infra·deploy compose와 devcontainer는 같은 Docker 네트워크로 묶인다. devcontainer 자신도 시작할 때 이 네트워크에 붙어야 하므로(`runArgs`의 `--network`), 컨테이너가 뜨기 전 호스트에서 실행되는 `initializeCommand`의 `network`가 네트워크를 미리 만든다.

## 부팅 순서

1. `initializeCommand` — 사용자명과 workspace basename을 조합한 Docker 네트워크와 도구 설정 디렉터리 준비 (호스트에서 실행)
2. 이미지 빌드 — `Dockerfile`이 digest로 고정한 Node 24 베이스에 k6, cloudflared, shellcheck, lychee, PlantUML, Playwright Chromium을 설치한다. 직접 다운로드하는 파일은 버전과 SHA-256을 함께 고정한다.
3. `postCreateCommand` — `npm install`(최초 1회). manifest와 lockfile을 동기화하며 설치한다.
4. `postStartCommand` — `bash infra/reset.sh`로 개발 인프라 기동 + PlantUML 서버

첫 부팅은 이미지 빌드와 인프라 이미지 다운로드 때문에 시간이 걸린다. 이후 부팅은 인프라 리셋 시간(약 30초)이 대부분이다.

베이스·인프라 이미지를 올릴 때는 버전 태그만 바꾸지 않고 multi-architecture digest를 함께 확인·갱신한다. Dockerfile에서 직접 받는 도구는 정확한 릴리스 URL과 amd64·arm64 자산의 존재를 확인한다.

네트워크·컨테이너·volume 이름은 사용자명과 workspace basename으로 구분한다. 같은 basename의 clone은 이름이 겹치므로, 같은 호스트에서 두 clone을 동시에 띄울 때는 서로 다른 폴더 이름을 사용한다. 개발 인프라는 host 포트를 publish하지 않는다. 선택 기능인 VersityGW Admin API와 WebUI도 활성화하지 않아 devcontainer를 추가로 띄워도 host 포트 때문에 부팅이 실패하지 않는다.

## 호스트 자격증명 마운트

기본 `devcontainer.json`은 호스트의 `~/.config/gh`, `~/.codex`, `~/.claude`, `~/.claude.json`을 컨테이너에 bind mount한다. 개발 도구 로그인을 재사용하기 위한 설정이지만, 컨테이너 안의 프로세스가 해당 자격증명에 접근할 수 있다는 뜻이다.

하지만 Dev Container는 호스트 Docker socket을 연결하므로 sandbox나 보안 경계가 아니다. 악성 스크립트는 Docker로 호스트 경로를 새로 마운트할 수 있다. 외부 PR처럼 신뢰하지 않는 revision은 컨테이너를 시작하기 **전에 호스트에서** `.devcontainer/`, npm lifecycle script, workflow·shell 변경과 전체 diff를 먼저 검토한다.

신뢰하는 저장소·커밋에서만 컨테이너를 열고 최소 권한·짧은 만료 토큰을 쓴다. 마운트가 필요하지 않은 도구는 개인 Dev Container override에서 제거할 수 있다.

## 의존성 설치 스크립트 승인

npm 12.0.2의 설치 스크립트 정책을 strict 모드로 사용한다. 의존성이 실행하는 `preinstall`·`install`·`postinstall`은 루트 `package.json`의 `allowScripts`에 정확한 버전으로 승인된 경우에만 실행되며, 새 스크립트가 들어오면 `npm install`과 `npm ci`가 실패한다. 패키지를 올린 뒤에는 `npm install-scripts ls`로 새 항목과 실제 스크립트를 검토하고 필요한 버전만 승인한다.

`fsevents` 승인은 macOS 설치용이라 Linux의 `npm install-scripts ls`에는 나타나지 않는다. Linux에서 `npm install-scripts prune`을 실행하면 이 교차 플랫폼 승인을 제거하므로 사용하지 않는다.
