# 개발 환경 설정

## 프로젝트 구조

### Mono

```
src/
├── controllers/          # HTTP API 컨트롤러, 인증
├── applications/         # 비즈니스 로직 서비스 (BullMQ)
├── cores/                # 도메인 모델, 리포지토리
├── infrastructures/      # 외부 서비스 연동 (결제, 파일)
├── config/               # 앱 설정, 비즈니스 규칙(Rules), 파이프, 미들웨어
├── __tests__/            # 단위/통합 테스트
├── tests/e2e/            # E2E 테스트 스펙
└── infra/local/          # 로컬 인프라 Docker Compose
```

### MSA

```
src/
├── config/               # 앱 설정, 비즈니스 규칙(Rules), 파이프, 미들웨어
├── apps/
│   ├── gateway/          # HTTP API 컨트롤러, 인증
│   ├── applications/     # 비즈니스 로직 서비스 (Temporal Workflow)
│   ├── cores/            # 도메인 모델, 리포지토리
│   ├── infrastructures/  # 외부 서비스 연동 (결제, 파일)
│   └── __tests__/        # 단위/통합 테스트
tests/e2e/                # E2E 테스트 스펙
infra/local/              # 로컬 인프라 Docker Compose
```

---

## Scripts

### Mono

| Script               | Description                                 |
| -------------------- | ------------------------------------------- |
| `npm run build`      | 프로덕션 빌드                               |
| `npm run start`      | 빌드된 앱 실행                              |
| `npm run debug`      | Watch 모드로 개발 실행                      |
| `npm test`           | 단위 테스트 실행 (coverage 포함)            |
| `npm run test:e2e`   | E2E 테스트 실행 (인프라 + 앱 자동 재시작)   |
| `npm run lint`       | TypeScript 타입 체크, ESLint, Prettier 검사 |
| `npm run format`     | ESLint 자동 수정 및 Prettier 포맷팅         |
| `npm run apps:reset` | 앱 서비스 초기화 (down + up + wait)         |

### MSA

| Script               | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `npm run build`      | 특정 앱 빌드 (`TARGET_APP=gateway npm run build`)         |
| `npm run start`      | 빌드된 앱 실행 (`TARGET_APP=gateway npm run start`)       |
| `npm run dev`        | Watch 모드로 개발 실행 (`TARGET_APP=gateway npm run dev`) |
| `npm test`           | 전체 테스트 실행 (단위 + E2E)                             |
| `npm run test:unit`  | 단위 테스트 실행 (coverage 포함)                          |
| `npm run test:e2e`   | E2E 테스트 실행 (인프라 + 앱 자동 재시작)                 |
| `npm run lint`       | TypeScript 타입 체크, ESLint, Prettier 검사               |
| `npm run format`     | ESLint 자동 수정 및 Prettier 포맷팅                       |
| `npm run apps:reset` | 앱 서비스 초기화 (down + up + wait)                       |

인프라는 Dev Container가 시작 시 자동으로 올린다. 수동 관리가 필요하면 `bash .devcontainer/reset-infra.sh`를 실행한다.

---

## 환경 파일

### `.devcontainer/.env`

Docker 이미지 태그와 인프라 접속 정보(MongoDB, Redis, NATS, MinIO, Temporal)를 통합 관리한다. Dev Container 실행 시 `--env-file`로 컨테이너 환경변수에 주입되므로, 앱과 테스트에서 별도 파일 로딩 없이 `process.env`로 접근 가능하다.

### `apps/mono/.env`, `apps/msa/.env`

앱 전용 설정만 포함한다. 프로젝트 ID, HTTP 포트, 인증, 로그 설정 등이 있다.

### 프로젝트 이름 변경

프로젝트를 포크해서 이름을 바꾸려면 두 곳을 수정한다.

- `.env`의 `PROJECT_ID`
- `package.json`의 `name`

---

## Dev Container

1. 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 설정한다.
2. VS Code에서 "Reopen in Container" 명령을 실행한다.
3. Dev Container는 `.devcontainer/Dockerfile`(베이스 `node:24-slim`)을 사용하며, `postCreateCommand`로 `npm ci`, `postStartCommand`로 인프라를 자동으로 시작한다.
4. Dev Container 안에서도 별도 환경 변수 설정 없이 `npm run test:e2e`를 바로 실행할 수 있다.

---

## VS Code

### 디버그 (`.vscode/launch.json`)

- **Mono**: `npm run debug`를 실행하여 Watch 모드로 앱을 디버깅한다.
- **MSA**: `npm run dev`를 실행하며 `TARGET_APP`을 선택한다.
    - 선택지: `gateway`, `applications`, `cores`, `infrastructures`

### 작업 (`.vscode/tasks.json`)

| Task            | Description                                       |
| --------------- | ------------------------------------------------- |
| `Run Tests`     | `npm test` 실행.                                  |
| `Run E2E Tests` | `npm run test:e2e` 실행. `curl`, `jq`가 필요하다. |

---

## 계층 의존성 규칙 (ESLint)

`eslint.config.js`의 `no-restricted-imports` 규칙으로 [SoLA 계층](design-guide.md#1-서비스-아키텍처--sola-service-oriented-layered-architecture) 위반을 빌드 타임에 감지한다.

**Mono** (`src/`):

| 계층              | 참조 금지 대상                                            |
| ----------------- | --------------------------------------------------------- |
| `controllers`     | 없음 (모든 하위 계층 참조 가능)                           |
| `applications`    | `controllers`                                             |
| `cores`           | `controllers`, `applications`                             |
| `infrastructures` | `controllers`, `applications`, `cores`                    |
| `shared`          | `controllers`, `applications`, `cores`, `infrastructures` |

**MSA** (`src/apps/`):

| 계층              | 참조 금지 대상                                        |
| ----------------- | ----------------------------------------------------- |
| `gateway`         | 없음 (모든 하위 계층 참조 가능)                       |
| `applications`    | `gateway`                                             |
| `cores`           | `gateway`, `applications`                             |
| `infrastructures` | `gateway`, `applications`, `cores`                    |
| `shared`          | `gateway`, `applications`, `cores`, `infrastructures` |

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

---

## 테스트에서 Dynamic Import

### Mono

각 테스트마다 고유한 DB 이름을 생성하기 위해 `process.env.TEST_ID`를 사용한다.

Jest 설정에서 `resetModules: true`를 적용하고, 테스트에서는 dynamic import를 사용하여 각 테스트가 독립된 환경에서 실행되도록 한다.

### MSA

여러 테스트에서 같은 NATS 서버를 공유하기 때문에, 각 테스트마다 고유한 subject를 생성하기 위해 `process.env.TEST_ID`를 사용한다.

Jest의 모듈 캐시 때문에 `@MessagePattern` 데코레이터가 모듈 로딩 시점에 한 번만 평가된다. 따라서 최상위에서 이미 import된 모듈은 새로운 `process.env.TEST_ID` 값을 인식하지 못한다.

이 문제를 해결하기 위해 Jest 설정에서 `resetModules: true`를 적용하고, 테스트에서는 dynamic import를 사용한다.

### 공통 예시

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

환경별 엔트리 파일을 분리하여 `process.env.NODE_ENV` 분기를 사용하지 않는다.

- `development.ts` — 개발 환경 엔트리
- `main.ts` — 공통 부트스트랩 로직
- `production.ts` — 프로덕션 환경 엔트리

**Mono** — `src/` 디렉터리에 엔트리 파일이 존재한다.

```json
// nest-cli.json — 개발 환경
"entryFile": "development"
```

**MSA** — 각 앱 디렉터리에 엔트리 파일이 존재한다.

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

**Mono:**

```
src/cores/services/foos/
├── foo.ts                        # 도메인 모델
├── foos.module.ts
├── foos.service.ts
├── foos.repository.ts            # MongoDB 리포지토리
├── errors.ts                     # FooErrors 상수
├── dto/
│   ├── create-foo.dto.ts
│   └── foo.dto.ts
└── index.ts                      # 공개 API 재수출
```

**MSA:**

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

**Mono** — `src/cores/cores.module.ts`의 `imports` 배열에 `FoosModule`을 추가한다. `FoosModule`은 `FoosService`를 `exports`해야 다른 계층에서 사용할 수 있다.

```typescript
@Module({
    exports: [FoosService],
    imports: [
        /* ... */
    ],
    providers: [FoosService, FoosRepository]
})
export class FoosModule {}
```

**MSA** — `src/apps/cores/cores.module.ts`의 `imports` 배열에 `FoosModule`을 추가한다.

```typescript
@Module({
    imports: [
        // ... 기존 모듈
        FoosModule
    ]
})
export class CoresModule {}
```

### 3. Gateway에서 사용

- **Mono**: Gateway의 HTTP 컨트롤러에서 `FoosService`를 직접 주입하여 사용한다.
- **MSA**: `src/apps/gateway`의 관련 모듈에서 `FoosClient`를 import하고, 컨트롤러에서 주입한다.

---

## 테스트 인프라

### 환경 변수

테스트는 `jest.global.ts`에서 Testcontainers를 시작하고 환경 변수를 설정하여 인프라에 연결한다.

| 함수                          | 환경 변수                  |
| ----------------------------- | -------------------------- |
| `getMongoTestConnection()`    | `TESTLIB_MONGO_*`          |
| `getRedisTestConnection()`    | `TESTLIB_REDIS_URL`        |
| `getNatsTestConnection()`     | `TESTLIB_NATS_OPTIONS`     |
| `getTemporalTestConnection()` | `TESTLIB_TEMPORAL_ADDRESS` |
| `getS3TestConnection()`       | `TESTLIB_S3_*`             |

### 커버리지 설정

`jest.config.ts`에서 100% 커버리지를 강제한다.

```typescript
coverageThreshold: {
    global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
    }
}
```

**커버리지 제외 대상**: `__tests__`, `main.ts`, `*.module.ts`, `index.ts`, `configure-app.ts`, `production.ts`, `development.ts`, `/workflows/`

---

## 트러블슈팅

### Dev Container 시작 후 인프라 연결 실패

`postStartCommand`로 실행된 인프라 시작이 완료되기 전에 테스트를 실행하면 연결 오류가 발생할 수 있다. 터미널에서 인프라 초기화가 완료될 때까지 기다린 후 테스트를 실행한다.

### `npm test` 실행 시 타임아웃

Testcontainers가 처음 실행될 때 Docker 이미지를 pull한다. 네트워크 환경에 따라 시간이 걸릴 수 있다. `.devcontainer/.env`에 정의된 이미지를 미리 `docker pull`해 두면 단축된다.

### ESLint 계층 규칙 위반 경고

`Layering rule: ...` 메시지가 나타나면 import 경로가 잘못된 계층을 참조하고 있는 것이다. 위의 계층 의존성 규칙 표를 참고하여 import를 수정하거나, 해당 로직을 올바른 계층으로 이동한다.

### MongoDB 트랜잭션 오류 (로컬)

로컬 MongoDB가 replica set으로 구성되지 않으면 트랜잭션이 실패한다. Dev Container를 재시작하면 인프라가 자동으로 초기화되어 3-node replica set이 구성된다.
