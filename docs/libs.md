# libs/ — 공유 패키지

워크스페이스 내부 공유 패키지 두 개다. 둘로 나뉜 기준은 **어디서 실행되는 코드인가**다.

## common — 런타임 공유 코드

앱이 운영 중에 실행하는 공유 코드다. Mongoose CRUD 기반 클래스, Redis 캐시·분산 락, JWT 인증, S3, NATS, 로거 등이 들어 있다. Restate 워크플로는 showtime-creation 도메인의 NestJS 제공자를 직접 사용하므로 공용 패키지에 억지로 추상화하지 않는다. 각 모듈의 사용법은 내보낸 심볼의 JSDoc(에디터 hover)이 소유하고, 도구 선택의 이유는 [설계 결정](reference/decisions.md)이 소유한다.

## testing — 테스트 전용 헬퍼

HttpTestClient와 픽스처 헬퍼처럼 테스트에서만 쓰는 코드다. common과 분리한 이유는 의존 방향이다 — 앱은 testing을 devDependencies로만 받으므로, 테스트 도구가 프로덕션 의존성에 섞이는 일이 패키지 경계에서 차단된다.

`pnpm-workspace.yaml`이 workspace 경로를 정의하고, pnpm은 패키지 의존 그래프에 따라 의존되는 패키지를 먼저 빌드한다.

테스트 지원 코드는 두 곳에 나뉜다 — 같은 기준("어디서 실행되는가")의 결과다. 테스트 코드가 import하는 헬퍼는 `libs/testing`(TS, 빌드 필요)이고, jest 설정(jest.setup/teardown)이 빌드 없이 곧장 require해야 하는 코드는 `tools/jest-helpers`(순수 CJS)다.
