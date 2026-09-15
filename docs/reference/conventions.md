# 개발 규칙

자동 포맷으로 해결되지 않는 이름·공개 계약·테스트 작성의 약속을 둔다. TypeScript 코드는 apps와 libs가 같은 기준을 따른다. 계층 배치와 HTTP 계약은 [apps](../apps.md), 외부 연동의 소유권은 [libs](../libs.md)가 설명한다.

## 1. 서비스와 메서드 이름

Core Service는 관리하는 도메인 이름을 쓴다(`UsersService`, `MoviesService`). 여러 도메인을 묶는 Application Service는 처리하는 유스케이스 이름을 쓴다(`PurchaseService`, `ShowtimeCreationService`).

서비스나 저장소를 호출해 필요한 데이터를 구하고 작업하는 역할에는 `Service`를 붙인다. 전달받은 데이터로만 계산하는 클래스는 `Validator`, `Recommender`처럼 역할로 이름 짓는다. `RecommendationService`가 데이터를 모으고 `MovieRecommender`가 추천을 계산하는 구분이다.

**함수명에 전달인자나 조회 조건을 나열하지 않는다.** 조건은 객체 인자로 전달해, 조건이 달라져도 같은 동작의 이름을 유지한다.

```ts
// 조회 API의 이름을 설계하는 예시
find({ id })
find({ email })
findTheaters({ movieId })
```

이는 `findById`, `findTheatersForMovie`처럼 조건별 메서드를 늘리지 않기 위한 규칙이다. 일반 유틸의 모든 단일 인자까지 객체로 감싸지는 않는다. 현재 [CrudRepository](../../libs/common/src/mongodb/crud.repository.ts)의 `ById` 계열은 이 규칙을 아직 따르지 않는 기존 API다.

서비스의 공개 메서드는 같은 이름이 같은 계약을 뜻하도록 맞춘다.

| 이름                    | 계약                                               |
| ----------------------- | -------------------------------------------------- |
| `create` / `createMany` | 단일 생성 / 필요한 경우의 일괄 생성                |
| `getMany`               | ID 목록으로 조회하며, 요청한 대상이 모두 있어야 함 |
| `search` / `searchPage` | 검색 조건으로 조회 / 페이지 정보와 함께 조회       |
| `update`                | 대상과 수정 본문을 받아 갱신                       |
| `deleteMany`            | ID 목록으로 삭제                                   |

ID만 받는 조회·삭제 서비스 API는 처음부터 `getMany`, `deleteMany`로 둔다. 단일 ID로 시작했다가 일괄 처리가 필요할 때 공개 계약을 바꾸지 않기 위해서다. HTTP의 단일 리소스 핸들러는 ID 하나를 배열로 감싸 호출하고, 응답은 그 엔드포인트의 계약에 맞춰 반환한다. 본문을 받는 생성·수정까지 무조건 일괄 API로 만들지는 않는다.

조회 이름은 결과가 없을 때의 계약도 드러낸다. `find`는 없는 결과를 호출자가 처리하고, `get`은 요청한 대상이 없으면 `NotFoundException`을 던진다. 단건 `find`의 `null`과 다건 `find`의 빈 배열·일부 결과를 구분한다. 서비스는 저장소 메서드를 그대로 노출하지 않고 위의 공개 계약으로 제공한다.

요청 DTO는 `동작 + 대상 + Dto` 형식으로 짓는다.

```ts
CreateTheaterDto
UpdateUserDto
SearchTheatersPageDto
```

응답 타입은 별도 계약이 필요할 때만 만든다. 서비스 모델로 충분하면 같은 필드를 복제한 응답 타입을 추가하지 않는다.

`xxxDate`는 달력상의 날짜, `xxxAt`은 특정 시점을 뜻한다. `releaseDate`는 개봉 날짜이고 `createdAt`은 생성 순간이다. 이 구분을 날짜·시점 타입과 직렬화에도 유지한다.

## 2. 타입은 계약에 맞춰 고른다

기본은 `type`이다. `interface`는 클래스가 `implements`해야 하거나 선언 병합이 필요한 자리에 사용한다. 단순히 객체 모양을 선언한다는 이유로 두 형식을 섞지 않는다.

## 3. Import와 공개 경계

모듈 밖에서 사용할 항목은 `index.ts`에 모으고, 소비자는 그 공개 진입점을 사용한다. 내부 구현은 내보내지 않는다. 특히 `internal/`과 `worker/`의 분해 방식이 외부 호출자의 계약이 되지 않게 한다.

모듈 내부 구현과 부모 방향의 import는 상대 경로를 쓴다. 자식에서 자기 계층의 barrel을 거꾸로 읽으면 그 barrel이 자식을 다시 읽어 순환이 생길 수 있다. 다른 모듈은 허용된 계층의 별칭과 공개 API로 참조한다. 별칭 사용 자체가 [SoLA 계층 규칙](../apps.md#1-sola-5계층)을 면제하지는 않는다.

```ts
// core/users/internal/user-authentication.service.ts
import { UsersRepository } from '../users.repository.js'

// gateway/users.http-controller.ts
import { UsersService } from '#core'
```

테스트와 fixture도 공개 기능을 검사할 때 실제 소비자가 쓰는 export를 가져온다. 비공개 구현 자체를 검증해야 할 때만 구현 파일을 직접 참조하고, 적용되는 lint 제한에는 그 예외를 명시한다.

### ESM의 소스 경로와 실행 경로

백엔드 TypeScript workspace는 Native ESM과 `NodeNext`를 사용한다. import의 확장자는 소스 파일이 아니라 빌드 후 Node가 읽을 파일을 가리킨다.

| 코드에 쓰는 경로     | 작성 중인 소스 / 실행 시 해석                                        |
| -------------------- | -------------------------------------------------------------------- |
| `./errors.js`        | TypeScript는 `errors.ts`로 검사하고 Node는 빌드된 `errors.js`를 읽음 |
| `../index.js`        | 디렉터리의 공개 진입점을 파일명까지 명시                             |
| `@mannercode/common` | workspace 패키지의 `main`·`exports` 계약                             |
| `#core`              | API `package.json#imports`의 내부 별칭                               |

상대 import에는 `.js`를 쓰고, 패키지 이름과 `#core` 같은 별칭에는 붙이지 않는다. Node ESM은 확장자나 디렉터리의 `index.js`를 자동으로 보충하지 않는다. 타입으로만 쓰는 항목은 `import type`으로 가져온다.

`"type": "module"`인 패키지의 `.js`는 ESM이다. CommonJS 도구는 `.cjs`, 패키지 설정과 무관하게 ESM을 명시할 도구는 `.mjs`를 쓴다. ESM에는 전역 `require`·`module.exports`·`__dirname`이 없으며, CommonJS 연동이 필요한 곳에서만 `createRequire(import.meta.url)`을 사용한다.

런타임 코드가 개발 환경에만 설치된 패키지에 기대지 않도록 의존성을 분류한다. `apps/api`의 외부 패키지 import 검사는 개발용 패키지를 테스트에서만 허용한다. `common`의 peer dependency를 앱이 설치하는 것과, 앱 소스가 해당 SDK를 직접 사용하는 것은 별개의 문제다.

## 4. 에러는 소유한 경계에서 정의한다

NestJS의 `HttpException`과 하위 예외를 프로젝트 공통 오류 타입으로 사용한다. Core·Application에서도 직접 던지며, Gateway에 같은 의미의 오류 번역 계층을 다시 만들지 않는다.

예상 가능한 도메인 실패는 해당 모듈의 `errors.ts`에 코드·메시지·문맥 필드를 가진 객체로 정의한다. 모듈의 `index.ts`에서 공개하고, 그 규칙을 소유한 코드가 적절한 공통 예외에 담아 던진다.

```ts
export const MovieErrors = {
    NotFound: (notFoundMovieId: string) => ({
        code: 'ERR_MOVIE_NOT_FOUND',
        message: 'The movie does not exist.',
        notFoundMovieId
    })
}
```

클라이언트가 분기해야 하는 4xx에는 `code`를 제공한다. `message`는 로그와 진단용이며 화면 문구는 클라이언트가 `code`로 정한다. 서버 장애의 자세한 원인은 5xx 응답에 노출하지 않는다. 한 파일에서만 쓰는 Gateway의 파싱·입력 오류는 가까이 둘 수 있고, 여러 핸들러가 공유하면 별도 `errors.ts`로 옮긴다.

MongoDB 오류 판별과 도메인 오류로의 변환은 Repository가 맡는다. 서비스가 드라이버 오류 코드나 세션 타입을 해석하지 않는다. 예외를 잡아 성공 결과나 임의의 기본값으로 바꾸지도 않는다.

## 5. 테스트 문장은 조건과 결과를 이어 읽게 쓴다

클래스·메서드·endpoint 같은 코드 식별자는 영어를 유지하고, 사용자 조건과 기대 결과는 쉬운 한국어로 쓴다. 조건을 선언한 `describe`와 그 아래 `it`을 이어 읽으면 하나의 시나리오가 되어야 한다.

```text
describe('UsersService')
└─ describe('POST /users')
   └─ describe('이메일이 이미 존재하면')
      ├─ beforeEach: 같은 이메일의 사용자를 만든다
      └─ it('409 Conflict를 반환한다'): 중복 가입을 요청하고 결과를 확인한다
```

- 조건형 `describe`의 준비는 해당 범위의 `beforeEach`가 맡는다. 제목에만 조건을 적고 각 `it`에서 같은 준비를 반복하지 않는다.
- `it`은 기본적으로 동작과 결과를 검증한다. 조건 자체가 만료·실패 같은 상태 전이라면 before hook이 그 전이까지 수행하고 `it`이 결과만 관찰할 수 있다.
- 한 번뿐인 조건은 `it('...이면 ...한다')`에 싣고 본문에서 준비해도 된다. `'인가 경계'`처럼 주제를 묶는 `describe`는 조건문이 아니므로 조건형 규칙을 적용하지 않는다.
- HTTP 응답은 “반환한다”, 서비스 예외는 “던진다”로 구분하고 부모에 적힌 조건을 `it`에 반복하지 않는다.
- 여러 결과를 실행 횟수 절약을 위해 한 `it`에 숨기지 않는다. 응답과 DB 반영은 각각 실패 의미가 드러나게 나누고, DB 반영은 가능한 한 공개 조회로 확인한다. 하나의 복합 불변식을 검증하는 데 필요한 matcher 수까지 제한하지는 않는다.
- 독립적인 입력·출력 사례는 `it.each`로 나눠 어느 입력이 실패했는지 각각 드러낸다. 앞 단계의 상태에 의존하는 시나리오를 단순 입력 목록으로 바꾸지는 않는다.

시나리오의 `beforeAll`은 여러 `it`이 의도적으로 순서 있는 하나의 흐름을 이어 검증할 때만 쓴다. 그때는 `describe.sequential`처럼 순서를 명시한다. 셋업 비용만 줄이려고 사용하지 않는다. worker 단위 연결·환경 준비처럼 하네스의 수명을 관리하는 전역 hook은 별개다.

함수 호출 횟수보다 API 응답·저장된 상태·외부 계약을 검증한다. 장애 주입·시간 제어·결정적인 동시성 조건을 위한 spy는 사용할 수 있지만, 실제 인프라를 가짜로 대체해 검증하려던 계약을 없애지 않는다. 구체적인 fixture와 자원 수명은 [apps의 테스트](../apps.md#4-테스트)를 본다.

## 6. 경로 이름은 범위를 드러낸다

파일 경로를 담는 변수는 디렉터리면 `Dir`, 파일까지 포함하면 `Path`로 끝낸다. 호출 측이 이름만 보고 `path.join`을 더 해야 하는지 판단할 수 있어야 한다.

```ts
const reportDir = '/work/reports'
const reportPath = '/work/reports/result.md'
```

환경 변수와 설정 키도 디렉터리를 가리킨다는 의미가 이름에 드러나게 한다.

## 7. 런타임 설정은 명시한다

환경이나 배포에 따라 바꿔야 하는 값은 env로 받고, 사용하는 코드가 부팅 시 검증한다. env로 받기로 한 설정은 env 파일과 배포 설정에 값을 명시하고 검증 스키마에 조용한 기본값을 두지 않는다.

배포 중 바꿀 필요가 없는 불변식은 사용하는 코드 가까이에 둔다. 모든 값을 env로 옮기면 설정 파일이 두 번째 코드베이스가 된다. 예를 들어 현재 티켓 가격은 API env가 소유하지만, 화면 조회 개수처럼 코드가 소유하는 정책까지 임의로 env에 추가하지 않는다. 파일별 소유권과 주입 시점은 [환경 변수](environment.md)를 따른다.

## 8. 잘못된 상태는 그 자리에서 실패시킨다

필수 shell 변수는 `${VAR:?}`로, 앱 env는 검증 스키마로 확인한다. 반드시 있어야 하는 값은 `Require.defined`·`ensure`로 단언한다. 실패를 원인에서 먼 곳까지 미루는 임의의 기본값이나 조용한 대체 경로를 넣지 않는다.

정리 작업은 소유한 대상을 명확히 식별해야 한다. 대상을 식별하지 못했는데 성공처럼 넘어가거나, 범위를 넓혀 전부 지우지 않는다. 요구사항에 없는 fallback이 필요해 보이면 무엇을 복구하며 실패 계약이 어떻게 달라지는지 먼저 설명하고 결정을 받는다.

## 9. pnpm 스크립트는 공통 인터페이스다

루트 `package.json`을 사람과 CI의 진입점으로 두고, workspace는 지원하는 동사를 같은 이름으로 제공한다. 의존 라이브러리의 빌드가 필요한 검사는 루트의 준비 단계를 통해 시작한다.

| 동사     | 의미                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| `dev`    | watch 실행                                                                          |
| `build`  | 실행·배포용 산출물 생성                                                             |
| `test`   | 개발 중 단위·통합·계약 회귀                                                         |
| `lint`   | 타입·코드·형식 검사, 루트에서 shell·문서 링크 검사 추가                             |
| `format` | 포맷 적용                                                                           |
| `atoz`   | 해당 workspace의 전체 검증, 루트에서는 설치·인프라 초기화와 외부 스택 검증까지 포함 |

`atoz`의 구체적인 단계는 workspace마다 다르다. 동일한 것은 “그 workspace를 전부 검증한다”는 의미다. 정확한 순서는 각 `package.json`이 소유하며, 실행 명령과 결과 위치는 [tests/README.md](../../tests/README.md)에 모은다.

## 10. 커밋은 의도를 말한다

Conventional Commits의 `type(scope): subject` 형식을 따른다. 제목은 바뀐 파일보다 변경의 의도를 설명한다. 허용 type은 commitlint 설정이 소유한다. `pre-commit`의 lint-staged가 staged 파일을 검사·정리하고 `commit-msg`가 메시지 형식을 검증한다.
