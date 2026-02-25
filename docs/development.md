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

---

## 계층 의존성 규칙 (ESLint)

`eslint.config.js`의 `no-restricted-imports` 규칙으로 SoLA 계층 위반을 빌드 타임에 감지한다.

| 계층 (`src/apps/`) | 참조 금지 대상                                        |
| ------------------ | ----------------------------------------------------- |
| `gateway`          | 없음 (모든 하위 계층 참조 가능)                       |
| `applications`     | `gateway`                                             |
| `cores`            | `gateway`, `applications`                             |
| `infrastructures`  | `gateway`, `applications`, `cores`                    |
| `shared`           | `gateway`, `applications`, `cores`, `infrastructures` |

규칙 위반 시 ESLint `warn`으로 보고된다. `npm run lint`로 전체 검사할 수 있다.

---

## 새 Core 서비스 추가 절차

Core 서비스(예: `FooService`)를 추가하는 경우를 예시로 설명한다. Applications/Infrastructures도 동일한 패턴을 따른다.

### 1. 디렉터리 및 파일 생성

```
src/apps/cores/services/foos/
├── foo.ts                        # 도메인 모델
├── foos.module.ts
├── foos.controller.ts            # NATS RPC 컨트롤러
├── foos.service.ts
├── foos.repository.ts            # MongoDB 리포지토리
├── foos.client.ts                # 다른 서비스에서 사용할 클라이언트
├── errors.ts                     # FooErrors 상수
├── dto/
│   ├── create-foo.dto.ts
│   └── foo.dto.ts
└── index.ts                      # 공개 API 재수출
```

### 2. 모듈 등록

`src/apps/cores/cores.module.ts`의 `imports` 배열에 `FoosModule`을 추가한다.

```typescript
@Module({
    imports: [
        // ... 기존 모듈
        FoosModule
    ]
})
export class CoresModule {}
```

### 3. Gateway에서 클라이언트 사용

`src/apps/gateway`의 관련 모듈에서 `FoosClient`를 import하고, 컨트롤러에서 주입한다.

---

## 트러블슈팅

### Dev Container 시작 후 인프라 연결 실패

`postStartCommand`로 실행된 `npm run infra:reset`이 완료되기 전에 테스트를 실행하면 연결 오류가 발생할 수 있다. 터미널에서 `npm run infra:reset`이 완료될 때까지 기다린 후 테스트를 실행한다.

### `npm test` 실행 시 타임아웃

Testcontainers가 처음 실행될 때 Docker 이미지를 pull한다. 네트워크 환경에 따라 시간이 걸릴 수 있다. `.env.infra`에 정의된 이미지를 미리 `docker pull`해 두면 단축된다.

### ESLint 계층 규칙 위반 경고

`Layering rule: ...` 메시지가 나타나면 import 경로가 잘못된 계층을 참조하고 있는 것이다. 위의 계층 의존성 규칙 표를 참고하여 import를 수정하거나, 해당 로직을 올바른 계층으로 이동한다.

### MongoDB 트랜잭션 오류 (로컬)

로컬 MongoDB가 replica set으로 구성되지 않으면 트랜잭션이 실패한다. `npm run infra:reset`으로 인프라를 재시작하면 3-node replica set이 자동으로 초기화된다.
