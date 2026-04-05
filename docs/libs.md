# libs 개발 가이드

패키지 구조와 모듈 목록은 [architecture.md](architecture.md)를 참조한다. 이 문서는 libs의 개발, 빌드, 테스트, 배포 워크플로우를 다룬다.

---

## Scripts

루트에서 실행한다.

| Script              | Description                         |
| ------------------- | ----------------------------------- |
| `npm run build`     | libs 3개 패키지 빌드                |
| `npm run test:unit` | Jest + Testcontainers로 단위 테스트 |
| `npm run lint`      | ESLint 검사                         |
| `npm run format`    | Prettier 포맷팅                     |

---

## 의존성 관리

### npm workspaces

루트 `package.json`의 `"workspaces": ["libs/*", "apps/*"]`로 모노레포를 구성한다. 루트 `node_modules/`에 호이스팅되므로 모든 workspace 패키지가 공유한다.

### 의존성 종류

| 구분               | 배포 포함 | 용도                                              | 예시                         |
| ------------------ | --------- | ------------------------------------------------- | ---------------------------- |
| `dependencies`     | O         | 라이브러리 내부에서만 사용, 소비자와 공유 불필요  | `winston`, `superagent`      |
| `peerDependencies` | X         | 소비자가 설치, 같은 인스턴스를 공유해야 정상 동작 | `@nestjs/common`, `mongoose` |
| `devDependencies`  | X         | 개발/테스트에서만 사용                            | `@mannercode/testing`        |

### devDependencies 루트 통합

libs 3개의 공통 devDependencies(NestJS, TypeScript, 테스트 도구 등)는 루트 `package.json`에서 일괄 관리한다. 각 lib의 `devDependencies`에는 workspace 패키지 참조(`@mannercode/testing`)만 남긴다.

### overrides

`overrides`는 간접 의존성(transitive dependency)의 버전을 강제한다.

```json
"overrides": {
    "class-validator": "0.14.4",
    "lodash": "^4.18.0"
}
```

- `class-validator`: NestJS 11이 0.15를 미지원하므로 0.14.4로 고정
- `lodash`: 보안 패치가 포함된 4.18 이상으로 강제

---

## TypeScript 설정

```
libs/
├── tsconfig.base.json       ← 공통 컴파일러 옵션 (strict, decorators, ESNext)
├── tsconfig.json            ← IDE/테스트용: base + paths 별칭 + noEmit
├── tsconfig.build.json      ← 빌드용: base + jest 타입 제외
│
└── {common,testing,microservices}/
    ├── tsconfig.json         ← ../tsconfig.json 상속 (IDE/테스트)
    └── tsconfig.build.json   ← ../tsconfig.build.json 상속 (tsc 빌드)
```

- `tsconfig.json`은 `@mannercode/*` paths 별칭을 정의하여, 빌드 없이 소스 간 직접 참조가 가능하다.
- `tsconfig.build.json`은 `jest` 타입을 제외하고 `dist/`로 출력한다. 테스트 파일(`*.spec.ts`, `__tests__/`)은 빌드에서 제외된다.

---

## 빌드 순서

`microservices`와 `testing`은 `common`에 의존하므로, `npm run build`는 common → microservices/testing 순으로 빌드한다. `npm-run-all2`의 `run-s`/`run-p`로 순차/병렬 실행을 제어한다.

---

## 테스트 인프라

### 실행 흐름

```
jest.global.js          Testcontainers로 인프라 기동 (1회)
  ↓                     NATS, MongoDB, Redis, MinIO, Temporal
jest.setup.js           각 테스트 스위트마다 실행
  ↓                     TEST_ID 생성, 전용 DB/S3 버킷 생성, 종료 시 DB 삭제
*.spec.ts               개별 테스트 실행
```

### 환경 변수

`jest.global.js`에서 Testcontainers를 시작하고 환경 변수를 설정한다.

| 환경 변수                  | 설정 주체           | 용도                  |
| -------------------------- | ------------------- | --------------------- |
| `TESTLIB_NATS_OPTIONS`     | `jest.global`       | NATS 연결 옵션 (JSON) |
| `TESTLIB_MONGO_URI`        | `jest.global`       | MongoDB 연결 문자열   |
| `TESTLIB_MONGO_DATABASE`   | `jest.setup`        | 테스트별 DB 이름      |
| `TESTLIB_REDIS_URL`        | `jest.global`       | Redis 연결 URL        |
| `TESTLIB_S3_*`             | `jest.global/setup` | MinIO/S3 설정         |
| `TESTLIB_TEMPORAL_ADDRESS` | `jest.global`       | Temporal 서버 주소    |
| `TEST_ID`                  | `jest.setup`        | 테스트 격리용 고유 ID |

### 테스트 격리

`jest.setup.js`에서 `beforeEach`마다 10자리 랜덤 `TEST_ID`를 생성한다. 이를 기반으로:

- MongoDB: `mongo-{TEST_ID}` 데이터베이스 생성, `afterEach`에서 삭제
- S3: `s3bucket{TEST_ID}` 버킷 생성
- NATS: `withTestId(subject)`로 고유 subject 생성

### Jest 설정

| 설정                         | 값                                   | 이유                                             |
| ---------------------------- | ------------------------------------ | ------------------------------------------------ |
| `resetModules`               | `true`                               | 테스트마다 모듈 캐시 초기화, `TEST_ID` 격리 보장 |
| `resetMocks`                 | `true`                               | mock 상태 자동 초기화                            |
| `testRegex`                  | `__tests__/.*\.spec\.ts`             | `__tests__` 폴더 내 spec 파일만 실행             |
| `testTimeout`                | 60초                                 | Testcontainers 기동 시간 고려                    |
| `coverageThreshold`          | 100% (전체)                          | branches, functions, lines, statements 모두 100% |
| `coveragePathIgnorePatterns` | `__tests__`, `index.ts`, `/testing/` | 테스트 코드, barrel, testing 패키지 제외         |

---

## ESLint

`libs/eslint.config.js`에서 전체 libs에 적용되는 규칙을 정의한다. ESLint FlatConfig 형식이다.

주요 규칙:

- **import 정렬**: `perfectionist/sort-imports`, `perfectionist/sort-exports` — natural 순서
- **barrel import 강제**: `no-restricted-imports` — 상위 폴더의 서브모듈 직접 import 금지
- **타입 import**: `consistent-type-imports` — `import type` 사용 강제
- **미사용 import 제거**: `unused-imports/no-unused-imports`
- **Promise 안전성**: `no-floating-promises`, `no-misused-promises`, `await-thenable`
- **switch 완전성**: `switch-exhaustiveness-check`
