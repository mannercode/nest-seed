# .devcontainer/ — 개발 환경

공식 개발 경로는 Dev Container 하나다. 로컬 직접 실행은 지원하지 않는다 — 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로).

## 환경 변수는 여기서 주입된다

`devcontainer.json`의 `runArgs`가 `.env.infra`와 `.env.api`를 `--env-file`로 컨테이너에 넣는다. 그래서 컨테이너 안의 모든 프로세스(dev 서버, 테스트, npm 스크립트)는 이 값들을 이미 주입된 `process.env`로 받는다. 앱은 `.env` 파일을 직접 읽지 않는다(`ignoreEnvFile`) — env 파일을 고친 뒤에는 컨테이너를 재시작해야 반영된다. 값의 전체 흐름은 [환경 변수](reference/environment.md)에 있다.

`containerEnv`는 두 값을 더 정의한다.

- `WORKSPACE_ROOT` — 저장소 루트의 절대 경로. 스크립트들이 `${WORKSPACE_ROOT:?}`로 받아 위치에 상관없이 저장소 파일을 가리킨다.
- `COMPOSE_PROJECT_NAME` — 작업 폴더 이름. infra와 deploy compose가 공유하는 Docker 네트워크의 이름이 된다.

## Docker는 호스트 것을 부린다 (DooD)

컨테이너 안에서 `docker` 명령을 실행해도 실제 작업은 호스트 Docker가 한다. 그래서 `workspaceMount`가 작업 폴더를 **호스트와 같은 경로**로 마운트한다 — 호스트 Docker가 compose 파일의 상대 경로를 그대로 찾을 수 있어야 하기 때문이다. `initializeCommand`의 `prepare-network`가 infra·deploy·devcontainer를 묶는 네트워크를 미리 만든다.

## 부팅 순서

1. `initializeCommand` — 마운트 디렉터리와 Docker 네트워크 준비 (호스트에서 실행)
2. 이미지 빌드 — `Dockerfile`이 Node 24에 고정 버전 도구들(k6, cloudflared, shellcheck, lychee, buildx, Playwright Chromium)을 설치한다. 버전을 GitHub release에서 고정하는 이유는 Dockerfile 주석에 있다.
3. `postCreateCommand` — `npm install` (최초 1회)
4. `postStartCommand` — `bash infra/reset.sh`로 개발 인프라 기동 + PlantUML 서버

첫 부팅은 이미지 빌드와 인프라 이미지 다운로드 때문에 시간이 걸린다. 이후 부팅은 인프라 리셋 시간(약 30초)이 대부분이다.
