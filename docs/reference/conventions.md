# 개발 규칙

자동 포맷으로 정할 수 없는 이름·공개 계약·오류·테스트의 작성 기준이다. 코드 배치는 [apps](../apps.md), 공통화 범위는 [libs](../libs.md)를 따른다.

## 이름은 동작과 계약을 설명한다

엔티티 집합을 관리하는 Core 서비스는 `UsersService`, `MoviesService`처럼 도메인의 복수형으로 이름 짓는다. 여러 도메인을 조합하는 Application 서비스는 `PurchaseService`, `ShowtimeCreationService`처럼 유스케이스를 나타내는 단수형 이름을 쓴다. 단수·복수는 한 요청이 처리하는 데이터 개수가 아니라 서비스의 역할에 따라 정한다.

데이터를 조회하고 다른 서비스를 조율하면 `RecommendationService`, 전달받은 데이터만 계산하면 `MovieRecommender`처럼 이름으로 역할을 구분한다.

이벤트 발행·구독을 담당하는 서비스도 `PurchaseEventService`처럼 `Service`로 끝내고 파일은 `purchase-event.service.ts`로 맞춘다. 이벤트 데이터인 `TicketPurchasedEvent`와 구분한다.

단순 조회의 조건은 객체 인자로 표현한다. 업무 목적이나 반환 정보로 다른 조회와 구분해야 하면 함수 이름에도 드러낸다.

```ts
find({ id })
find({ email })
findForAuthentication({ email })
findByPurchaseRecordId({ purchaseRecordId })
```

`existsByMovieIds`, `existsByTheaterIds`처럼 조건을 이름에 드러내도 된다. 이름을 줄이기 위해 두 함수를 합치고 `movieIds`와 `theaterIds`를 판별하는 분기를 추가하지 않는다. 단일 값 유틸까지 객체 인자로 바꿀 필요는 없다. 비슷한 타입의 인자가 많아 의미를 혼동하기 쉬우면 속성 이름이 있는 객체로 받는다.

| 이름                    | 기본 계약                                             |
| ----------------------- | ----------------------------------------------------- |
| `find` / `findMany`     | 단건은 없으면 null, 여러 건은 찾은 결과만 배열로 반환 |
| `get` / `getMany`       | 요청한 대상 중 하나라도 없으면 NotFoundException      |
| `search` / `searchPage` | 조건 검색 / 페이지 정보를 포함한 검색                 |

이 시드의 일반 서비스 조회·삭제는 `getMany`·`deleteMany`를 사용한다. 단건 HTTP 핸들러는 `[id]`로 호출하고 단건 응답을 반환한다. 이후 일괄 호출을 추가할 때 계약을 다시 만들지 않으려는 선택이다. 생성·수정과 업무상 특별한 조회까지 일괄 API로 바꾸지는 않는다.

요청 DTO는 `CreateTheaterDto`, `UpdateUserDto`, `SearchTheatersPageDto`처럼 동작과 대상을 이름에 드러낸다. `releaseDate` 같은 달력 날짜와 `createdAt` 같은 시점은 이름뿐 아니라 타입과 직렬화 형식에서도 구분한다.

경로 변수는 파일을 가리키면 `Path`, 디렉터리를 가리키면 `Dir`로 끝낸다. 호출자가 경로에 파일명을 더 붙여야 하는지 알 수 있게 한다.

## 타입과 변환

객체·유니온은 기본적으로 `type`으로 선언한다. 클래스가 구현할 계약을 선언하거나 선언 병합이 필요하면 `interface`를 쓴다.

HTTP 요청·응답과 JSON에서 복원할 데이터는 Zod 스키마로 정의하고 `z.infer`로 타입을 얻는다. 타입 이름은 `Dto`, 실행 시 검사·변환에 쓸 스키마 이름은 `Schema`로 끝낸다. [극장 생성 DTO](../../apps/api/src/services/core/theaters/dtos/create-theater.dto.ts)가 그 예다.

```ts
export type CreateTheaterDto = z.infer<typeof CreateTheaterSchema>
```

요청 검사·변환에는 `CreateTheaterSchema`, 검증된 값을 받는 함수 인자에는 `CreateTheaterDto`를 사용한다. 같은 필드를 클래스와 스키마에 두 번 적지 않는다. JSON 경계를 통과하지 않는 내부 함수 인자까지 스키마를 새로 만들 필요는 없다.

JSON 본문의 숫자·불리언·문자열은 선언한 타입으로 받는다. 쿼리 숫자나 날짜처럼 변환이 필요한 필드만 명시적으로 변환한다. 수정 필드를 생략하면 기존 값을 유지하며, `null`은 실제 모델이 허용할 때만 받는다.

JSON 복원과 HTTP 테스트에서 스키마를 사용하는 방법은 [공유 패키지의 JSON과 DTO 복원](../libs.md#4-json과-dto-복원)을 따른다.

## Import와 공개 경계

다른 모듈의 기능은 공개 `index.ts`를 통해 사용한다. `internal/`·`worker/`의 내부 구성은 공개하지 않고, 앱 조립에 필요한 workflow 정의 등만 명시적으로 공개한다. 모듈 내부나 부모 모듈을 참조할 때는 상대 import를 사용한다.

```ts
// core/users/internal/user-authentication.service.ts
import { UsersRepository } from '../users.repository.js'

// gateway/users.http-controller.ts
import { UsersService } from '#core'
```

하위 모듈이 자신을 다시 export하는 `index.ts`를 import하면 순환 참조가 생길 수 있다. 경로 별칭을 써도 같은 계층의 다른 모듈을 참조할 수는 없다. 테스트도 공개 기능은 실제 소비자가 쓰는 진입점으로 검증한다. 비공개 구현 자체를 검사해야 하는 경우에만 예외를 둔다.

백엔드는 Node의 ESM과 TypeScript의 NodeNext 설정을 사용한다. 상대 import의 `.js`는 빌드 후 Node가 읽을 파일을 가리키며 TypeScript는 대응하는 `.ts`를 검사한다. 패키지 이름과 `#core` 같은 별칭에는 확장자를 붙이지 않는다. 디렉터리 import 대신 `index.js`를 명시하고 타입만 참조할 때는 `import type`을 사용한다.

ESM 패키지 안의 CommonJS 도구는 `.cjs`, ESM 형식을 명시할 도구는 `.mjs`를 쓴다. CommonJS 패키지에서는 `.js` 도구도 CommonJS로 실행된다. common의 peer dependency 설치와 SDK 호출 경계는 [공유 패키지](../libs.md#2-common은-연동-구현을-소유한다)를 따른다.

## 오류와 불변식

NestJS `HttpException`과 하위 예외를 Core·Application에서도 사용한다. 예상한 실패는 해당 도메인의 `errors.ts`에 코드·메시지·문맥을 정의한다. 해당 조건을 판단한 코드가 이를 알맞은 예외에 담아 던지므로 Gateway에서 같은 의미의 오류로 다시 변환하지 않는다.

```ts
throw new ConflictException(MovieErrors.DeleteBlockedByShowtimes(movieId))
```

서비스는 업무 조건을 판단한다. Repository는 고유 키 충돌처럼 DB가 원자적으로 판정한 결과를 도메인 예외로 바꾼다. MongoDB 오류 번호·드라이버 세션은 서비스로 보내지 않는다. 클라이언트가 구분해야 할 4xx 오류에는 `code`를 두고, 5xx 오류의 내부 원인은 응답 본문 대신 진단에 남긴다.

필수 환경 변수는 부팅 시 검증하고 필수 shell 변수는 `${VAR:?}`로 확인한다. 코드 내부의 필수 값은 `ensure`·`Require.defined`로 검사한다.

환경에 따라 달라지는 설정은 환경 변수로 주입한다. 화면 조회 개수처럼 배포 환경과 관계없이 유지할 정책은 관련 코드에 둔다.

## 테스트는 한 행동의 결과를 검증한다

API는 `src/__tests__`에서 실제 모듈과 인프라를 연결하는 통합 테스트를 기본으로 한다. 복잡한 계산이나 독립적인 변환 계약은 직접 검증할 수 있다. 단순 위임 함수마다 단위 테스트를 추가하지 않으며, 새 테스트 파일을 만들 때는 저장소 작업 지침을 따른다.

코드 식별자는 영어로, 조건과 기대 결과는 한국어로 쓴다. 상위 `describe`의 조건과 `it`의 설명을 이어 읽을 수 있어야 한다.

제목은 조건과 결과를 이해할 수 있는 문장으로 쓴다. “키를 소비하지 않는다”보다 “수정한 요청을 같은 키로 다시 보낼 수 있다”처럼 관찰하는 결과를 드러낸다. 기술명·필드명은 구분에 필요할 때 유지한다. 매개변수로 나눈 사례도 `실패=true`나 긴 객체 대신 뜻이 드러나는 조건 이름을 쓴다.

```text
describe('POST /users')
└─ describe('같은 이메일이 존재하면')
   ├─ beforeEach: 기존 사용자를 준비한다
   └─ it('409 Conflict를 반환한다')
```

상태·실행 환경에 관한 조건은 `describe`로 묶고 그 조건을 만드는 작업은 해당 `beforeEach`에 둔다. `it`에는 검증할 동작과 결과 단언을 둔다. 한 테스트에서만 쓰는 조건도 같은 구조를 따른다. HTTP 응답은 “반환한다”, 서비스 예외는 “던진다”로 구분한다. 입력만 다른 독립 사례는 `it.each`로, 같은 검증에 필요한 준비 조건까지 달라지면 `describe.each`로 나눈다.

API spec에서는 `createAppTestContext`와 공통 훅이 앱을 준비하고 정리하게 한다. spec에는 조건 준비, 동작 호출, 결과 단언이 드러나게 한다. 데이터 준비·외부 상태 조회·장애 주입을 돕는 함수는 대응하는 `*.utils.ts`에 둔다. 테스트 설명에는 기대 동작을 쓰고, 프로세스 수나 관측 방식에 따른 검증 한계는 필요한 본문 주석에 남긴다.

**한 행동의 응답과 DB 반영은 같은 테스트에서 확인할 수 있다.** 서로 독립적인 조건이나 실패 원인을 한 테스트에 섞지 않는 것이 기준이다. 응답과 DB 검증을 기계적으로 나눠 같은 흐름을 반복하지 않는다. 가능하면 공개 조회로 결과를 확인한다.

실제 연결을 유지하면서 실패를 주입하거나 시간을 제어하고 동시 실행을 조율하는 spy는 사용할 수 있다. insert를 mock으로 생략하면 실제 transaction rollback을 확인할 수 없다. `sendRaw()`의 응답 상태는 호출자가 반드시 검사하고, 제목에는 실제 단언으로 확인한 보장만 쓴다.

각 테스트는 자신이 만든 앱·연결·비동기 작업을 종료한다. 작업 완료는 Promise나 프로토콜 상태로 확인하며, 일정 시간의 sleep이 지났다는 이유로 완료됐다고 판단하지 않는다. TTL 만료 자체를 검증하는 경우에는 시간을 기다릴 수 있다. 여러 테스트 묶음이 상태를 공유할 때는 의도한 순차 시나리오임을 명시하며, 준비 비용을 줄이기 위해 테스트를 서로 의존하게 만들지 않는다.

[설계 결정](decisions.md)에 따른 100% 커버리지 기준을 유지한다. 실행되지 않는 방어 분기는 먼저 구조를 검토하고, 커버리지에서 제외해야 한다면 그 근거를 남긴다.

## 실행과 커밋

개발자와 CI는 루트의 package script로 실행한다. 각 workspace는 지원하는 `dev`, `build`, `test`, `lint`, `format`, `atoz` 명령을 같은 뜻으로 제공한다. 실제 검사 범위는 각 package script에서, 명령별 사용법은 [README의 실행 안내](../../README.md#실행과-검증)에서 확인한다.

커밋 메시지는 Conventional Commits의 `type(scope): subject` 형식으로 변경 의도를 쓴다. 허용하는 type과 커밋 hook의 동작은 commitlint·lint-staged 설정에서 확인한다.
