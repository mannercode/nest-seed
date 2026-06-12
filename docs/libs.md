# libs/ — 공유 패키지

워크스페이스 내부 npm 패키지 세 개다. 셋으로 나뉜 기준은 **어디서 실행되는 코드인가**다.

## common — 런타임 공유 코드

앱이 운영 중에 실행하는 공유 코드다. Mongoose CRUD 기반 클래스, Redis 캐시·분산 락, JWT 인증, S3, NATS, Temporal 클라이언트, 로거가 들어 있다. 각 모듈의 사용법은 내보낸 심볼의 JSDoc(에디터 hover)이 소유하고, 도구 선택의 이유는 [설계 결정](reference/decisions.md)이 소유한다.

## testing — 테스트 전용 헬퍼

HttpTestClient와 픽스처 헬퍼처럼 테스트에서만 쓰는 코드다. common과 분리한 이유는 의존 방향이다 — 앱은 testing을 devDependencies로만 받으므로, 테스트 도구가 프로덕션 의존성에 섞이는 일이 패키지 경계에서 차단된다.

## temporal-sandbox — 워크플로 샌드박스 코드

Temporal 워크플로 본문은 결정적 샌드박스에서 실행되고 webpack으로 따로 번들된다. NestJS 데코레이터가 있는 모듈을 가져오면 번들이 깨지므로([설계 결정 §3](reference/decisions.md#3-saga-오케스트레이션-temporal-워크플로)의 트레이드오프), 워크플로에 들어가도 안전한 코드만 이 패키지에 격리한다. 의존성이 `@temporalio/workflow`뿐인 것이 그 제약의 표현이다.

루트 package.json의 workspaces 배열 순서가 곧 빌드 순서다 — 의존되는 패키지가 앞에 온다.
