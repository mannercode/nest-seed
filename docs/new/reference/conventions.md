# 개발 규칙

자동 포맷이 결정하지 못하는 이름·공개 계약·오류·테스트의 기준이다. 배치는 [apps](../apps.md), 공통화 범위는 [libs](../libs.md)를 따른다.

## 이름은 동작과 계약을 설명한다

Core는 관리하는 도메인(`UsersService`), Application은 조합하는 유스케이스(`PurchaseService`)로 이름 짓는다. 데이터를 조회하고 협력을 조율하는 `RecommendationService`와 전달받은 데이터만 계산하는 `MovieRecommender`처럼 역할을 구분한다. 이름만 맞추려고 새 계층이나 클래스를 추가하지 않는다.

단순 조회의 조건은 객체 인자로 표현한다. 업무 목적·반환 정보·다른 조회와의 구분이 중요하면 이름에도 드러낸다.

```ts
find({ id })
find({ email })
findForAuthentication({ email })
findByPurchaseRecordId({ purchaseRecordId })
```

`ById` 같은 문자열을 일괄 금지하지 않는다. 이름을 줄이려고 `movieIds` 또는 `theaterIds`를 판별하는 분기를 추가하기보다 `existsByMovieIds`, `existsByTheaterIds`를 유지한다. 단일 값 유틸까지 모두 객체로 감싸지 않고, 비슷한 타입의 인자가 많아 의미를 혼동하기 쉬울 때 이름 있는 객체 인자를 사용한다.

| 이름                    | 기본 계약                                                     |
| ----------------------- | ------------------------------------------------------------- |
| `find` / `findMany`     | 없으면 null / 빈 배열 또는 일부 결과를 반환하고 호출자가 판단 |
| `get` / `getMany`       | 요청한 대상이 없으면 NotFoundException                        |
| `search` / `searchPage` | 조건 검색 / 페이지 정보를 포함한 검색                         |
| `create` / `createMany` | 단건 생성 / 필요한 경우의 일괄 생성                           |
| `update`                | 대상과 변경 내용을 받아 갱신                                  |
| `deleteMany`            | ID 목록 삭제                                                  |

이 시드의 일반 서비스 조회·삭제는 `getMany`·`deleteMany`를 사용한다. 단건 HTTP 핸들러는 `[id]`로 호출하고 단건 응답을 반환한다. 이후 일괄 호출을 추가할 때 계약을 다시 만들지 않으려는 선택이다. 생성·수정과 업무상 특별한 조회까지 일괄 API로 바꾸지는 않는다.

요청 DTO는 `CreateTheaterDto`, `UpdateUserDto`, `SearchTheatersPageDto`처럼 동작·대상을 드러낸다. `releaseDate` 같은 달력 날짜와 `createdAt` 같은 순간의 의미를 타입과 직렬화에서도 구분한다. 파일 경로 변수는 파일이면 `Path`, 디렉터리면 `Dir`로 끝내 호출자가 결합할 대상을 알 수 있게 한다.

## 타입과 변환

객체·유니온의 기본 선언은 `type`이다. 클래스 구현 계약이나 선언 병합에는 `interface`를 사용하는 프로젝트 스타일을 따른다. 객체 형태의 type alias도 `implements`할 수 있으므로 언어의 제약으로 설명하지 않는다.

HTTP 요청·응답과 JSON에서 복원할 데이터는 Zod 스키마를 계약으로 삼고 `z.infer`로 타입을 얻는다. 같은 필드를 클래스와 스키마에 두 번 적지 않는다. JSON 경계를 통과하지 않는 내부 함수 인자까지 스키마를 새로 만들 필요는 없다.

JSON 본문의 숫자·불리언·문자열은 선언한 타입으로 받는다. 쿼리 숫자나 날짜처럼 변환이 필요한 필드만 명시적으로 변환한다. 수정 필드를 생략하면 기존 값을 유지하며, `null`은 실제 모델이 허용할 때만 받는다.

```ts
const { body } = await fix.httpClient
    .post('/purchases')
    .headers(headers)
    .body(createDto)
    .created({ schema: PurchaseRecordSchema, expected })
```

`schema`가 응답을 검사·변환하고 `body` 타입도 결정한다. `expected`를 주면 변환된 응답과 비교한다. 제네릭 타입 인자만으로 런타임 날짜를 복원할 수는 없다. `JSON.parse`는 JSON 해석만 하고, 날짜 문자열을 추측하는 전역 reviver를 두지 않는다.

## Import와 공개 경계

모듈 소비자는 공개 `index.ts`를 사용한다. `internal/`·`worker/`의 분해 방식은 외부 계약으로 만들지 않고, 앱 조립에 필요한 workflow 정의 등만 명시적으로 공개한다. 모듈 내부·부모 방향은 상대 import를 사용한다.

```ts
// core/users/internal/user-authentication.service.ts
import { UsersRepository } from '../users.repository.js'

// gateway/users.http-controller.ts
import { UsersService } from '#core'
```

자식이 자기 계층의 barrel을 다시 읽으면 barrel이 자식을 가져오며 순환할 수 있다. 별칭을 썼다는 이유로 같은 계층 모듈 간 참조가 허용되지는 않는다. 테스트도 공개 기능은 실제 소비자가 쓰는 진입점으로 검증하며, 비공개 구현 자체를 검사하는 예외만 좁게 둔다.

백엔드는 Native ESM·NodeNext를 사용한다. 상대 import의 `.js`는 빌드 후 Node가 읽을 파일이며 TypeScript는 대응하는 `.ts`를 검사한다. 패키지 이름과 `#core` 같은 별칭에는 확장자를 붙이지 않는다. 디렉터리 import 대신 `index.js`를 명시하고 타입 전용 참조에는 `import type`을 사용한다.

ESM package 안의 CommonJS 도구는 `.cjs`, 명시적 ESM 도구는 `.mjs`를 쓴다. CommonJS package의 `.js` 도구도 해당 package 설정을 따른다. runtime 의존성을 devDependency에 기대지 않게 분류한다. common의 peer SDK를 앱이 설치하는 것과 앱 코드에서 SDK를 직접 실행하는 것은 별개다.

## 오류와 불변식

NestJS `HttpException`과 하위 예외를 Core·Application에서도 사용한다. 예상한 실패는 해당 도메인의 `errors.ts`에 코드·메시지·문맥을 정의하고, 그 규칙을 소유한 코드가 알맞은 예외에 담아 던진다. Gateway에 같은 의미의 번역 계층을 다시 만들지 않는다.

```ts
throw new ConflictException(MovieErrors.DeleteBlockedByShowtimes(movieId))
```

서비스는 업무 조건을 판단한다. Repository는 unique key 충돌 등 저장소에서 원자적으로 판정되는 결과를 도메인 예외로 바꾼다. MongoDB 오류 번호·드라이버 세션은 서비스로 보내지 않는다. 클라이언트가 분기할 4xx에는 `code`를 두고, 서버 내부 원인은 5xx 응답 본문 대신 진단에 남긴다.

필수 env는 부팅 시 검증하고 필수 shell 변수는 `${VAR:?}`로 확인한다. 필수 내부 값에는 `ensure`·`Require.defined`를 사용한다. 실패를 성공이나 조용한 기본값으로 바꾸지 않는다. 외부 효과의 결과가 불명확하면 실패와 성공 중 하나로 추측하지 말고 그 경계의 기존 계약을 따른다.

환경에 따라 달라지는 설정은 env가, 배포 중 바꿀 필요가 없는 불변식은 가까운 코드가 소유한다. 화면 조회 개수 같은 코드 정책을 모두 env로 옮기지 않는다.

## 테스트는 한 행동의 결과를 검증한다

API는 `src/__tests__`에서 실제 모듈과 인프라를 연결하는 통합 테스트를 기본으로 한다. 복잡한 계산이나 독립적인 변환 계약은 직접 검증할 수 있다. 단순 위임 함수마다 unit test를 추가하지 않으며, 새 테스트 파일은 저장소 작업 지침에 따른다.

코드 식별자는 영어로, 조건과 기대 결과는 한국어로 쓴다. 부모 조건과 테스트 설명을 이어 읽을 수 있어야 한다.

```text
describe('POST /users')
└─ describe('같은 이메일이 존재하면')
   ├─ beforeEach: 기존 사용자를 준비한다
   └─ it('409 Conflict를 반환한다')
```

같은 조건의 준비는 그 describe에 모으고, 한 번뿐인 조건은 `it('...이면 ...한다')` 안에서 준비해도 된다. HTTP 응답은 “반환한다”, 서비스 예외는 “던진다”로 구분한다. 독립 입력 사례는 `it.each`로 분리한다.

**한 행동의 응답과 DB 반영은 같은 테스트에서 확인할 수 있다.** 서로 독립적인 조건·실패 의미를 한 테스트에 숨기지 않는 것이 기준이다. 응답용·DB용 테스트로 기계적으로 쪼개 같은 비싼 흐름을 반복하지 않는다. 가능하면 공개 조회로 결과를 확인한다.

실제 연결은 유지하면서 실패 주입·시간 제어·동시성 barrier를 위한 spy는 사용할 수 있다. 실제 insert를 생략한 mock으로 transaction rollback을 검증했다고 해서는 안 된다. `sendRaw()`의 응답 상태는 호출자가 반드시 검사하고, 제목은 실제 단언보다 강한 보장을 주장하지 않는다.

각 테스트는 만든 앱·연결·비동기 작업의 종료를 책임진다. 완료는 Promise·프로토콜 상태로 기다리고 임의의 sleep으로 추측하지 않는다. TTL 만료 자체를 검증하는 시간 경과와는 구분한다. suite 간 상태 공유는 의도한 순차 시나리오에서만 명시하며 단순한 준비 비용 절감 때문에 테스트를 서로 의존하게 만들지 않는다.

100% 커버리지는 [설계 결정](decisions.md)의 제약을 유지한다. 실행되지 않는 방어 분기는 먼저 구조를 검토하고, 제외가 불가피하면 그 근거를 남긴다. 검사를 통과시키기 위한 skip·약한 assertion·운영 코드의 테스트 전용 분기는 만들지 않는다.

## 실행과 커밋

루트 package script가 사람과 CI의 진입점이다. workspace는 지원하는 `dev`, `build`, `test`, `lint`, `format`, `atoz` 동사를 같은 뜻으로 제공한다. 검사 범위는 각 package script가 소유하며 명령별 안내는 [테스트 실행](test-execution.md)에 둔다.

커밋은 Conventional Commits의 `type(scope): subject`를 사용해 변경 의도를 쓴다. 허용 type과 hook 동작은 commitlint·lint-staged 설정이 소유한다.
