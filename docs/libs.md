# libs/ — 공유 패키지

공유 코드는 **어디서 실행되는가**로 나뉜다.

운영 중 앱이 호출하는 코드는 common, spec이 사용하는 client·fixture는 testing, 소스 변환 전에 테스트를 부팅하는 코드는 [tools](tools.md)에 둔다. 같은 기술을 사용한다는 이유로 도메인 모델까지 common으로 모으지 않는다. 공개 심볼의 인자·사용 예시는 JSDoc이, 도구 선택의 근거는 [설계 결정](reference/decisions.md)이 소유한다.

## 1. common — 런타임 코드

앱이 운영 중 사용하는 외부 연동 구현을 소유한다. `apps/api/src`의 MongoDB 연결·드라이버 호출, Redis 명령, bcrypt·JWT, S3, NATS·JetStream, Restate 실행 서버·클라이언트는 `common`을 통해 사용한다. 앱에는 collection별 쿼리와 인덱스, 이벤트 내용, workflow의 업무 단계와 정책을 둔다. 특정 도메인에서만 쓰더라도 SDK 실행과 연결 수명 관리는 이 경계를 따른다.

연동 설정은 앱이 제공한다. common이 특정 앱의 env 파일 위치를 알아야 하거나 직접 찾아 읽게 만들지 않는다.

NestJS·Zod·RxJS와 Express 타입·HTTP 미들웨어처럼 앱을 작성하고 초기화하는 API는 직접 사용한다. `apps/api/scripts`의 독립 실행 스크립트는 SDK를 직접 사용하며 `common`과 그 빌드에 의존하지 않는다. 테스트는 외부 상태 관찰과 장애 주입을 위해 SDK를 직접 사용할 수 있다.

console과 user-app의 쿠키·프록시·갱신 처리는 각 앱이 소유한다. 두 데모를 독립적으로 읽고 수정할 수 있도록 frontend 코드를 common으로 모으거나 서로의 런타임 코드에 의존하게 만들지 않는다.

workspace 의존 그래프에 따라 라이브러리를 소비자보다 먼저 빌드한다. common의 peer dependency는 소비하는 앱이 설치해야 할 런타임 계약이다. 앱의 `package.json`에 MongoDB·Redis SDK가 남아 있다는 사실만으로 `apps/api/src`가 이를 직접 사용하는 것은 아니다. 독립 스크립트와 패키지 설치의 요구도 함께 확인한다.

공통 유틸은 구현의 출처보다 찾기 쉬운 기능 이름과 일관된 사용법을 기준으로 제공한다. `apps/api/src`는 UUID·해시·시간·JSON 직렬화·환경·경로에 이미 제공된 유틸을 사용한다. `generateUuid`처럼 Node.js 기본 기능도 이 기준에 따라 감싸고 구현 교체를 한곳에서 처리할 수 있다. 사용처가 적어도 기존 래퍼를 없애지 않으며, Node.js API 전체를 복제하거나 런타임 교체에 대비한 추상화를 만들지는 않는다.

일반 JSON 파싱은 `JSON.parse`를 사용한다. 날짜처럼 보이는 문자열이나 큰 정수 토큰의 타입을 추측하지 않는다. 객체 복원은 DTO 스키마가 선언한 필드에서 수행한다. 정밀도 보존이 필요한 큰 정수는 JSON 문자열 계약으로 다뤄야 한다. `JsonUtil.stringify`와 HTTP 응답은 Instant를 UTC 밀리초 3자리, PlainDate를 날짜 문자열로 출력한다.

Restate는 같은 JSON 형식을 저장하며 workflow 입력, `ctx.run`에서 읽은 DTO 결과, client의 최종 결과를 각 스키마로 복원한다. journal에서 재생된 값도 이 경계를 거친다. 단계 이름·순서와 저장된 JSON 형식은 복구 계약이므로 DTO 변경 시 기존 데이터와 함께 확인한다.

트랜잭션은 DB 타입을 포함하지 않는 `TransactionContext`로 전달한다. MongoDB 세션과 드라이버 실행 옵션은 공통 Repository가 관리한다. 앱의 Repository는 필요한 snapshot 실행과 시간 제한을 선택한다. 이 경계는 외부 연동 구현의 소유권을 정하며, MongoDB 쿼리를 다른 DB에서도 실행할 수 있게 만드는 추상화는 아니다.

문서 ID는 앱의 DTO와 Repository에서 문자열로 주고받는다. Repository는 `this.idFilter(id)`·`this.idsFilter(ids)`로 BSON ID 조건을 명시적으로 만든다. 조건식과 집계 파이프라인을 순회하며 `_id` 문자열을 자동 해석하지 않는다. 생성·조회·갱신한 문서에는 문자열 `id`만 반환하며, ID를 제외한 projection에는 `id`를 추가하지 않는다.

`newDocument`가 만드는 객체도 문자열 `id`를 가지며, 저장할 때 BSON `_id`로 바뀐다. `toDomainDocument`는 native 문서가 아니라 ID와 시간 값이 변환된 문서를 받는다. `upsertedId`와 중첩 결과의 ObjectId도 문자열로 반환하지만, aggregation의 `_id` 필드명은 그룹 의미를 유지한다.

```text
앱 DTO·Repository: id 문자열
          ↓ common의 드라이버 경계
MongoDB 저장·조회: BSON ObjectId
          ↓ common의 결과 변환
앱이 받는 문서: id 문자열
```

예를 들어 버전 조건은 `{ ...this.idFilter(id), __v: version }`, 복합 조건은 `{ $or: [this.idsFilter(ids), { title }] }`로 조립한다. 집계의 문서 ID 조회도 같은 helper를 쓰고, 문자열 그룹 키는 `{ $match: { _id: "group-name" } }`처럼 그대로 작성한다. Temporal 값의 BSON Date 변환은 실제 타입을 기준으로 계속 수행한다. 모든 DB에서 같은 filter가 실행된다는 보장은 아니다.

## 2. testing — 테스트 소비자용 코드

spec이 import하는 HTTP client와 fixture helper를 둔다. 앱은 이 패키지를 dev dependency로만 받으므로 테스트 도구가 운영 의존성에 섞이지 않는다.

HTTP 응답 변환은 `.created({ schema: PurchaseRecordSchema })`처럼 스키마를 명시한다. `body`는 스키마의 출력 타입으로 추론되며 변환 실패는 테스트 실패다. `{ schema, expected }`는 변환된 결과도 비교하고, `{ expected }`는 변환 없이 비교한다. 스키마 없이 호출하면 일반 JSON 타입을 유지한다.

Vitest가 소스 변환 전에 불러야 하는 자원 준비·정리 로직은 `tools/vitest-helpers`에 둔다. 테스트 코드가 직접 쓰는 패키지와 테스트 런타임을 부팅하는 도구를 구분하기 위한 경계다.

```text
apps/api 운영 코드 ─→ libs/common
spec·fixture       ─→ libs/testing
Vitest 부팅 단계   ─→ tools/vitest-helpers
apps/api 운영 코드 ─╳ libs/testing
```
