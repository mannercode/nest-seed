# libs/ — 공유 패키지

공유 코드는 **어디서 실행되는가**로 나뉜다.

## 1. common — 런타임 코드

앱이 운영 중 사용하는 MongoDB, Redis/cache, JWT, S3, NATS, 로거 코드다. 특정 도메인에서만 쓰는 구현을 공유 패키지로 올리지 않는다. 예를 들어 Restate workflow는 showtime-creation의 NestJS 제공자를 직접 사용하므로 해당 도메인에 남는다.

## 2. testing — 테스트 소비자용 코드

spec이 import하는 HTTP client와 fixture helper를 둔다. 앱은 이 패키지를 dev dependency로만 받으므로 테스트 도구가 운영 의존성에 섞이지 않는다.

Vitest가 소스 변환 전에 불러야 하는 자원 준비·정리 로직은 `tools/vitest-helpers`에 둔다. 테스트 코드가 직접 쓰는 패키지와 테스트 런타임을 부팅하는 도구를 구분하기 위한 경계다.

```text
apps/api 운영 코드 ─→ libs/common
spec·fixture       ─→ libs/testing
Vitest 부팅 단계   ─→ tools/vitest-helpers
apps/api 운영 코드 ─╳ libs/testing
```
