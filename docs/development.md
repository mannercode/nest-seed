# 개발 환경 설정

## 환경 파일

### `.env`

애플리케이션과 테스트에서 공용으로 사용하는 설정 파일이다. 프로젝트 ID, 포트, MongoDB/Redis/NATS/MinIO 접속 정보, 로그 설정 등이 포함된다.

기본값은 `host.docker.internal`을 바라보도록 되어 있으므로, 다른 네트워크 환경이라면 호스트 IP를 맞춰야 한다.

### `.env.infra`

로컬 인프라 및 Jest Testcontainers에서 사용할 Docker 이미지 태그를 정의한다.

```env
MONGO_IMAGE=mongo:8.2.3
REDIS_IMAGE=redis:8.4-alpine
NATS_IMAGE=nats:2.12-alpine
MINIO_IMAGE=minio/minio:latest
```

### 프로젝트 이름 변경

프로젝트를 포크해서 이름을 바꾸려면 두 곳을 수정한다.

- `.env`의 `PROJECT_ID`
- `package.json`의 `name`

---

## Dev Container

1. 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 설정한다.
2. VS Code에서 "Reopen in Container" 명령을 실행한다.
3. Dev Container는 `.devcontainer/Dockerfile`(베이스 `node:24-slim`)을 사용하며, `postCreateCommand`/`postStartCommand`로 `npm ci` 및 `npm run infra:reset`을 자동 실행한다.
4. Dev Container 안에서도 별도 환경 변수 설정 없이 `npm run test:e2e`를 바로 실행할 수 있다.

---

## VS Code

### 디버그 (`.vscode/launch.json`)

- **Debug App**: `npm run debug`를 실행하며 `TARGET_APP`을 선택한다.
    - 선택지: `gateway`, `applications`, `cores`, `infrastructures`

### 작업 (`.vscode/tasks.json`)

| Task            | Description                                            |
| --------------- | ------------------------------------------------------ |
| `Run Tests`     | `npm test` 실행. `TEST_ROOT` 입력으로 범위를 지정한다. |
| `Run E2E Tests` | `npm run test:e2e` 실행. `curl`, `jq`가 필요하다.      |
| `Repeat Tests`  | 선택한 테스트 명령을 N회 반복 실행한다.                |
