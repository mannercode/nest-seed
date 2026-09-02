# NestJS 12 `@MessagePattern` 테스트 격리 데모

이 프로젝트는 두 방식을 최소 코드로 비교한다.

1. `fixed-namespace.spec.ts`: Vitest worker마다 `MESSAGE_NAMESPACE`를 한 번 정하고,
   정적으로 평가된 `@MessagePattern`으로 실제 NATS 요청을 왕복한다. 모듈 reset이 필요 없다.
2. `dynamic-loader.spec.ts`: 테스트마다 pattern을 바꿔야 할 때 `vi.resetModules()`와 중앙
   `loadAppRuntime()`을 함께 사용하여 전체 런타임 모듈 그래프를 다시 가져온다.

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

## 핵심

`@MessagePattern`의 pattern은 모듈을 가져올 때 메타데이터로 고정된다. 실제 MSA와 가장
비슷한 방식은 같은 배포 스택에 속한 프로세스들이 하나의 고정 message namespace를 쓰는
것이다. 이 데모에서는 동시에 실행되는 Vitest worker끼리만 namespace를 나눈다.

테스트마다 다른 pattern이 반드시 필요하다면 동적 import 한 개만 감싸서는 부족하다. Nest
DI에서 사용하는 controller와 module도 같은 새 모듈 그래프에 있어야 하므로
`loadAppRuntime()`처럼 함께 가져와야 한다.
