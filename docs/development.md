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
TEMPORAL_IMAGE=temporalio/auto-setup:1.25
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

`eslint.config.js`의 `no-restricted-imports` 규칙으로 [SoLA 계층](design-guide.md#1-서비스-아키텍처--sola-service-oriented-layered-architecture) 위반을 빌드 타임에 감지한다.

| 계층 (`src/apps/`) | 참조 금지 대상                                        |
| ------------------ | ----------------------------------------------------- |
| `gateway`          | 없음 (모든 하위 계층 참조 가능)                       |
| `applications`     | `gateway`                                             |
| `cores`            | `gateway`, `applications`                             |
| `infrastructures`  | `gateway`, `applications`, `cores`                    |
| `shared`           | `gateway`, `applications`, `cores`, `infrastructures` |

규칙 위반 시 ESLint `warn`으로 보고된다. `npm run lint`로 전체 검사할 수 있다.

---

## Import 규칙

각 폴더에 `index.ts`(barrel export)를 두어 공개 API를 재수출한다. 순환 참조를 방지하기 위해 다음 규칙을 따른다.

- **직계 조상 폴더**는 **상대 경로**로 import한다.

    ```ts
    /* users.service.ts */

    // (X) 순환 참조 발생 가능
    import { AuthService } from 'src/services'

    // (O) 상대 경로로 참조
    import { AuthService } from '../auth'
    ```

- **직계 조상이 아닌 폴더**는 **절대 경로**를 사용한다.

    ```ts
    /* users.controller.ts */

    // (O) 절대 경로 사용
    import { AuthService } from 'src/services'

    // (X) 상대 경로로는 권장하지 않음
    import { AuthService } from '../services'
    ```

> 폴더마다 `index.ts`를 두면 순환 참조를 더 빨리 발견할 수 있다.

### testlib와 common의 순환 참조

`src/libs`에는 `testlib`와 `common`이 있다. `testlib`는 `common`을 import하고, `common`의 `__tests__` 폴더에서 `testlib`를 import한다. 언뜻 순환처럼 보이지만, `__tests__` 폴더는 테스트 전용이며 런타임에 참조되지 않으므로 실제 순환 참조 문제가 발생하지 않는다.

---

## 테스트에서 Dynamic Import

여러 테스트에서 같은 NATS 서버를 공유하기 때문에, 각 테스트마다 고유한 subject를 생성하기 위해 `process.env.TESTLIB_ID`를 사용한다.

Jest의 모듈 캐시 때문에 `@MessagePattern` 데코레이터가 모듈 로딩 시점에 한 번만 평가된다. 따라서 최상위에서 이미 import된 모듈은 새로운 `process.env.TESTLIB_ID` 값을 인식하지 못한다.

이 문제를 해결하기 위해 Jest 설정에서 `resetModules: true`를 적용하고, 테스트에서는 dynamic import를 사용한다.

```ts
// 타입 전용 import는 런타임에 영향을 주지 않는다
import type { Fixture } from './customers.fixture'

describe('Customers', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createCustomersFixture } = await import('./customers.fixture')
        fix = await createCustomersFixture()
    })
})
```

---

## Entry File 구조

각 앱 디렉터리에는 다음 파일이 존재한다.

- `development.ts` — 개발 환경 엔트리
- `main.ts` — 공통 부트스트랩 로직
- `production.ts` — 프로덕션 환경 엔트리

`main.ts`에서 `process.env.NODE_ENV` 분기를 사용하는 대신, 환경별 엔트리 파일을 분리하여 복잡성을 줄인다.

```json
// nest-cli.json — 개발 환경
"entryFile": "apps/gateway/development"
```

```js
// webpack.config.js — 프로덕션 빌드
entry: path.resolve(dirname, 'production.ts')
```

---

## ESM Modules

NestJS는 CommonJS 모듈 시스템을 사용하지만, Node.js >= 22에서는 CommonJS와 ESM을 동시에 지원하므로 호환성 문제가 없다.

그러나 Jest는 아직 ESM을 완전히 지원하지 않으므로, ESM 전용 모듈(예: `chalk`)을 사용할 때는 `jest.config.ts`에 등록해야 한다.

```ts
{
    transformIgnorePatterns: ['!node_modules/(?!chalk)']
}
```

---

## Commit Message 규칙

`@commitlint/config-conventional` 규칙을 사용한다. 커밋 메시지는 아래 형식을 따라야 하며, 위반 시 커밋이 실패한다.

**형식**: `type: subject` 또는 `type(scope): subject`

| type       | 용도                          |
| ---------- | ----------------------------- |
| `feat`     | 기능 추가                     |
| `fix`      | 버그 수정                     |
| `docs`     | 문서 변경                     |
| `style`    | 코드 의미 변화 없는 포맷 변경 |
| `refactor` | 리팩터링                      |
| `perf`     | 성능 개선                     |
| `test`     | 테스트 추가/수정              |
| `build`    | 빌드/의존성 관련              |
| `ci`       | CI 설정/스크립트 변경         |
| `chore`    | 기타 잡무                     |
| `revert`   | 되돌리기                      |

예: `feat: add user login`, `fix(api): handle null pointer in auth`

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
