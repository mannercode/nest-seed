# NestJS 12 `@MessagePattern` 테스트 격리 데모

이 프로젝트는 두 방식을 최소 코드로 비교한다.

1. `fixed-namespace.spec.ts`: Vitest worker마다 `MESSAGE_NAMESPACE`를 한 번 정하고,
   정적으로 평가된 `@MessagePattern`으로 실제 NATS 요청을 왕복한다. 모듈 reset이 필요 없다.
2. `dynamic-loader.spec.ts`: 테스트마다 pattern을 바꿔야 할 때 `vi.resetModules()`와 중앙
   `loadAppRuntime()`을 함께 사용하여 전체 런타임 모듈 그래프를 다시 가져온다.

코드의 주석은 NestJS, NATS, ESM, Vitest를 처음 접하는 사람을 기준으로 작성했다.
아래 순서로 읽으면 실행 흐름을 따라가기 쉽다.

1. `vitest.config.ts`와 `src/__tests__/setup.ts`
2. `src/message-patterns.ts`
3. `src/calculator.controller.ts`와 `src/calculator.module.ts`
4. `src/create-nats-test-stack.ts`
5. 두 `*.spec.ts` 파일

## 실행

의존성을 설치한다.

```bash
pnpm install --ignore-workspace
```

NATS가 `127.0.0.1:4222`에 없다면 먼저 실행한다.

```bash
docker run --rm --name nest-message-pattern-demo-nats -p 4222:4222 nats:2-alpine
```

다른 주소를 사용할 때는 `NATS_URL` 또는 `NATS_HOST`와 `NATS_PORT`를 지정한다.

```bash
pnpm test
pnpm typecheck
```

`vitest`만 실행하면 watch mode로 계속 떠 있지만, package script의 `pnpm test`는
`vitest run`을 실행하므로 테스트를 한 번 수행하고 종료한다.

## package.json 해설

`package.json`은 표준 JSON이라 `//` 주석을 넣을 수 없다. 대신 주요 항목을 여기서 설명한다.

| 항목                        | 역할                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `private: true`             | 실수로 npm registry에 배포하는 것을 막는다.                                                      |
| `type: module`              | `.js` 파일을 CommonJS가 아닌 ESM으로 해석한다. TypeScript의 `NodeNext` 설정과 한 쌍이다.         |
| `test`                      | `vitest run`으로 전체 테스트를 한 번 실행한다.                                                   |
| `typecheck`                 | 파일을 생성하지 않고 `tsc --noEmit`으로 타입 오류만 검사한다.                                    |
| `@nestjs/common`, `core`    | Module, Controller, Nest application context 같은 기본 기능이다.                                 |
| `@nestjs/microservices`     | `@MessagePattern`, NATS transport, `ClientProxy`를 제공한다.                                     |
| `@nats-io/transport-node`   | NestJS 12의 NATS transport가 실제 broker에 연결할 때 쓰는 NATS v3 client다.                      |
| `reflect-metadata`          | 데코레이터가 기록한 metadata를 런타임에서 읽게 한다. Nest 부트스트랩 전에 한 번 import해야 한다. |
| `rxjs`                      | `ClientProxy.send()`가 반환하는 Observable을 제공한다.                                           |
| `vitest`                    | 테스트 runner와 assertion, mock, module reset API를 제공한다.                                    |
| `typescript`, `@types/node` | TypeScript 검사기와 Node.js API 타입이다.                                                        |

`pnpm-lock.yaml`은 pnpm이 정확한 하위 의존성 버전을 기록한 자동 생성 파일이므로 직접
주석을 달거나 수정하지 않는다.

## Vitest 용어

- `describe(name, fn)`: 관련 테스트와 hook에 이름과 범위를 부여한다.
- `it(name, fn)`: 독립적으로 성공하거나 실패하는 테스트 한 건이다. `test()`와 같다.
- `beforeEach(fn)`: 범위 안의 각 `it()` 직전에 실행한다.
- `afterEach(fn)`: 범위 안의 각 `it()`이 끝날 때 실행하며 자원 정리에 주로 쓴다.
- `expect(value)`: 실제 값에 matcher를 적용해 결과를 검증한다.
- `vi`: Vitest의 mock, timer, module cache 같은 테스트 런타임 기능을 제공한다.
- `setupFiles`: 각 테스트 파일이 import되기 전에 먼저 실행할 초기화 파일 목록이다.
- `worker`: 여러 테스트 파일을 나누어 실행하는 프로세스 또는 thread다. 이 데모는
  `pool: 'forks'`이므로 자식 프로세스를 사용한다.

## 한 테스트의 실행 순서

고정 namespace 테스트 한 건은 다음 순서로 실행된다.

1. Vitest가 `setup.ts`를 실행해 `MESSAGE_NAMESPACE`를 만든다.
2. 테스트 파일과 그 정적 의존성을 import한다.
3. `message-patterns.ts`가 환경 변수를 읽어 NATS subject를 한 번 만든다.
4. `beforeEach`가 정리 함수 변수를 초기화한다.
5. `it`이 Nest NATS server와 client를 시작하고 실제 요청을 보낸다.
6. `afterEach`가 client와 server를 닫는다.

## 핵심

`@MessagePattern`의 pattern은 모듈을 가져올 때 메타데이터로 고정된다. 실제 MSA와 가장
비슷한 방식은 같은 배포 스택에 속한 프로세스들이 하나의 고정 message namespace를 쓰는
것이다. 이 데모에서는 동시에 실행되는 Vitest worker끼리만 namespace를 나눈다.

테스트마다 다른 pattern이 반드시 필요하다면 동적 import 한 개만 감싸서는 부족하다. Nest
DI에서 사용하는 controller와 module도 같은 새 모듈 그래프에 있어야 하므로
`loadAppRuntime()`처럼 함께 가져와야 한다.
