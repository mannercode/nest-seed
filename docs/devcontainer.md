# .devcontainer/ — 개발 환경

공식 개발 경로는 Dev Container 하나다. MongoDB Replica Set·Redis Cluster·NATS·Restate 등을 같은 토폴로지로 재현해 환경 차이를 줄이기 위함이다. 로컬 직접 실행을 병행 지원하지 않는 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로)에 있다.

시작 시 의존성 설치가 끝난 뒤 pnpm script를 실행한다. pnpm의 자동 설치와 명시적 설치가 겹치면 같은 `node_modules`를 동시에 수정할 수 있으므로 병렬로 시작하지 않는다.

## 1. 환경 변수는 재생성해야 반영된다

개발용 env 파일은 Dev Container를 **만들 때** 주입된다. 값을 바꾼 뒤 `docker restart`만 하면 이전 값이 남는다. `Rebuild Container`로 재생성해야 한다. 앱은 env 파일을 직접 읽지 않고 실행 환경이 주입한 `process.env`만 검증한다.

값의 소유권과 포크 시 바꿀 대상은 [환경 변수](reference/environment.md)에 있다.

## 2. Docker-outside-of-Docker의 경로 계약

컨테이너 안의 Docker CLI는 호스트 Docker socket을 통해 호스트 데몬을 조작한다. Compose가 넘긴 bind-mount 경로를 여는 주체도 호스트이므로, workspace는 호스트와 Dev Container 안에서 **같은 절대경로**에 있어야 한다. 이 제약 때문에 Remote SSH로 호스트 폴더를 먼저 열고 `Reopen in Container`를 실행하는 경로만 지원한다. `Clone Repository in Container Volume`은 지원하지 않는다.

```text
호스트 /home/me/project ↔ 컨테이너 /home/me/project       가능
호스트 /home/me/project ↔ 컨테이너 /workspaces/project   불가
```

두 번째 경우 컨테이너가 `/workspaces/project`를 mount source로 넘기면, 호스트 Docker daemon도 호스트의 그 경로를 찾으므로 원래 workspace를 볼 수 없다.

같은 호스트에서 basename이 같은 clone을 동시에 열면 Docker 프로젝트와 네트워크 이름이 충돌한다. 동시에 쓸 clone은 폴더 이름을 다르게 둔다.

## 3. 보안 경계

Dev Container는 호스트 Docker socket과 개발 도구의 자격증명을 마운트하므로 sandbox가 아니다. 신뢰하지 않는 revision은 컨테이너를 열기 **전에** `.devcontainer/`, 의존성 lifecycle script, workflow·shell 변경을 호스트에서 검토한다. 자격증명은 최소 권한·짧은 만료를 사용한다.

pnpm의 의존성 설치 스크립트도 명시적으로 승인한 정확한 버전만 실행한다. 패키지를 올릴 때는 새 lifecycle script의 내용과 lockfile integrity를 확인한 뒤 승인한다. 현재 승인 목록과 절차의 정확한 명령은 `pnpm-workspace.yaml`과 pnpm CLI가 소유한다.
