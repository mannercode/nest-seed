# libs/ — 공유 패키지

공유 코드는 **어디서 실행되는가**로 나뉜다.

## 1. common — 런타임 코드

앱이 운영 중 사용하는 외부 연동 구현을 소유한다. `apps/api/src`의 MongoDB 연결·드라이버 호출, Redis 명령, bcrypt·JWT, S3, NATS·JetStream, Restate 실행 서버·클라이언트는 `common`을 통해 사용한다. 앱에는 collection별 쿼리와 인덱스, 이벤트 내용, workflow의 업무 단계와 정책을 둔다. 특정 도메인에서만 쓰더라도 SDK 실행과 연결 수명 관리는 이 경계를 따른다.

NestJS·Zod·RxJS와 Express 타입·HTTP 미들웨어처럼 앱을 작성하고 초기화하는 API는 직접 사용한다. `apps/api/scripts`의 독립 실행 스크립트는 SDK를 직접 사용하며 `common`과 그 빌드에 의존하지 않는다. 테스트는 외부 상태 관찰과 장애 주입을 위해 SDK를 직접 사용할 수 있다.

공통 유틸은 구현의 출처보다 찾기 쉬운 기능 이름과 일관된 사용법을 기준으로 제공한다. `apps/api/src`는 UUID·해시·시간·JSON·환경·경로에 이미 제공된 유틸을 사용한다. `generateUuid`처럼 Node.js 기본 기능도 이 기준에 따라 감싸고 구현 교체를 한곳에서 처리할 수 있다. 사용처가 적어도 기존 래퍼를 없애지 않으며, Node.js API 전체를 복제하거나 런타임 교체에 대비한 추상화를 만들지는 않는다.

트랜잭션은 DB 타입을 포함하지 않는 `TransactionContext`로 전달한다. MongoDB 세션과 드라이버 실행 옵션은 공통 Repository가 관리한다. 앱의 Repository는 필요한 snapshot 실행과 시간 제한을 선택한다. 이 경계는 외부 연동 구현의 소유권을 정하며, MongoDB 쿼리를 다른 DB에서도 실행할 수 있게 만드는 추상화는 아니다.

## 2. testing — 테스트 소비자용 코드

spec이 import하는 HTTP client와 fixture helper를 둔다. 앱은 이 패키지를 dev dependency로만 받으므로 테스트 도구가 운영 의존성에 섞이지 않는다.

Vitest가 소스 변환 전에 불러야 하는 자원 준비·정리 로직은 `tools/vitest-helpers`에 둔다. 테스트 코드가 직접 쓰는 패키지와 테스트 런타임을 부팅하는 도구를 구분하기 위한 경계다.

```text
apps/api 운영 코드 ─→ libs/common
spec·fixture       ─→ libs/testing
Vitest 부팅 단계   ─→ tools/vitest-helpers
apps/api 운영 코드 ─╳ libs/testing
```
