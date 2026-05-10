# 컨벤션

이 문서는 코드 리뷰나 자동화로 강제되는 약속들을 모아 둔다. _왜 이렇게 정했는지_ 가 중요한 항목은 함께 적었고, 나머지는 일관성 자체가 목적이라고 보면 된다.

## 1. 네이밍

### 1.1. 디렉토리 배치

`apps/*/src/` 안의 자리는 _서비스 코드인지, 그 바깥 자원인지_ 로 갈라 둔다.

- **`apps/*/src/services/`** — 서비스 코드 묶음. application / core / gateway / infrastructure 네 레이어가 들어간다.
- **`apps/*/src/config/`** — 앱이 돌면서 읽어야 하는 값을 모아 둔 자리. 환경 변수를 묶어 주는 `AppConfigService`, `getProjectId`, mongoose 스키마 옵션처럼 부팅할 때 한 번 정해진 뒤 모든 레이어가 가져다 쓰는 값들.
- **`apps/*/src/modules/`** — NestJS 모듈을 모아 두는 자리. `AppConfigModule`, `GlobalModule`, `HealthModule`, 그리고 외부 자원과의 연결을 잡아 주는 `MongooseSetupModule` 같은 `*-setup` 모듈이 들어간다.
- **`apps/*/src/` 직속** — 서비스도 config 도 modules 도 아닌, 앱을 부팅하는 코드 그 자체. `bootstrap.ts`, `app.module.ts`, `development.ts`, `production.ts`.

`core/` 안에는 따로 공유 자리를 두지 않는다. 두 도메인이 비슷한 자료 구조를 다룬다고 해도, 억지로 한 모델로 묶지 않고 각 도메인이 자기 의미에 맞는 이름으로 따로 정의한다 (예: Theater 의 `Seat` = 극장이 정의하는 좌석, Ticket 의 `SeatPosition` = 티켓이 가리키는 좌석 좌표). 모양이 우연히 같다고 해서 같은 모델로 묶을 이유는 없다.

### 1.1.1. `libs/common` 의 의미

`libs/common` 은 _각 프로젝트가 자기 안으로 가져다 쓰는_ 라이브러리 묶음이다. import 해 와서 그 프로젝트의 빌드 결과물 안에 같이 들어가는 코드 — 의존성으로 끌어와 내 일부로 만든다. 상속해서 쓰는 베이스 클래스 (`BaseConfigService`, `CrudSchema`), 정적 유틸 (`DateUtil`, `TimeUtil`), 주입해서 쓰는 서비스 (`AppLoggerService`) 등 형태는 다양하다.

| 위치                 | 관계                                    | import 경로          |
| -------------------- | --------------------------------------- | -------------------- |
| `libs/common/`       | 각 프로젝트의 일부가 되는 라이브러리    | `@mannercode/common` |
| `apps/*/src/config/` | 서비스가 의존하는 환경/외부 자원 진입점 | `'config'`           |

### 1.2. 파일

| 유형                    | 패턴                          | 예시                                    |
| ----------------------- | ----------------------------- | --------------------------------------- |
| DTO                     | `[action-entity].dto.ts`      | `create-user.dto.ts`                    |
| 페이지네이션 검색 DTO   | `search-[entity].page.dto.ts` | `search-users.page.dto.ts`              |
| 비페이지네이션 검색 DTO | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| 결과 (동기 벌크)        | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| 응답 (비동기 요청)      | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| 모델                    | `[entity].ts`                 | `user.ts`                               |
| 에러                    | `errors.ts`                   | `errors.ts`                             |

### 1.3. 메서드

서비스가 바깥으로 내미는 메서드는 이름만 봐도 무슨 일을 하는지 알 수 있게 이름을 통일한다. 같은 이름은 어느 서비스에서든 같은 동작을 한다.

| 메서드                             | 용도                       | 반환                          |
| ---------------------------------- | -------------------------- | ----------------------------- |
| `create`                           | 단일 생성                  | `EntityDto`                   |
| `createMany`                       | 벌크 생성                  | `Create[Entity]Result`        |
| `getMany`                          | ID 조회 (모두 존재해야 함) | `EntityDto[]`                 |
| `search`                           | 비페이지네이션 필터        | `EntityDto[]`                 |
| `searchPage`                       | 페이지네이션               | `PaginationResult<EntityDto>` |
| `update`                           | 단일 수정                  | `EntityDto`                   |
| `deleteMany`                       | ID 삭제                    | `void`                        |
| `allExist` / `anyExist` / `exists` | 존재 확인                  | `boolean`                     |

Repository에는 `findById` / `findByIds` 와 `getById` / `getByIds` 가 있다. `find` 계열은 없으면 `null` 을 돌려주고 호출자가 처리하게 두는 반면, `get` 계열은 없으면 그 자리에서 `NotFoundException` 을 던진다. 이 두 쌍은 Repository 안에서만 쓰고 서비스 바깥으로는 노출하지 않는다.

### 1.4. 서비스 이름의 단/복수와 suffix

서비스 이름에는 두 가지 축이 있다. 하나는 _단수냐 복수냐_, 다른 하나는 _`Service` suffix를 붙이느냐 마느냐_ 다.

먼저 단/복수는 이 서비스가 _프로세스 중심_ 인지 _엔티티 관리 중심_ 인지로 가른다.

| 유형               | 예시                                | 설명               |
| ------------------ | ----------------------------------- | ------------------ |
| 프로세스 (단수)    | `BookingService`, `PurchaseService` | 특정 프로세스 처리 |
| 엔티티 관리 (복수) | `MoviesService`, `TheatersService`  | 엔티티 CRUD        |

다음으로 suffix는 _이 클래스가 스스로 일을 처리하는가, 계산만 하는가_ 로 가른다. 다른 서비스를 직접 호출해 작업을 끝내는 클래스에는 `Service` 를 붙이고, 외부에서 데이터를 모두 받아 계산만 하는 클래스에는 붙이지 않는다.

```
ShowtimeBulkValidatorService  ← Showtimes/Movies/Theaters 서비스를 직접 호출
ShowtimeBulkValidator         ← 호출자가 데이터를 주입하고, 검증 계산만 수행
```

### 1.5. Predicate 와 검증 함수

상태나 권한을 묻는 함수는 접두어로 의미를 드러낸다.

| 접두어   | 용도                |
| -------- | ------------------- |
| `is`     | 상태 확인           |
| `has`    | 소유 여부           |
| `can`    | 권한이나 가능 여부  |
| `should` | 규칙 기반 권장 여부 |

검증 함수는 _실패했을 때 어떻게 동작하는가_ 로 동사를 고른다.

| 동사     | 동작                        |
| -------- | --------------------------- |
| `verify` | 실패하면 예외를 던진다      |
| `check`  | 결과를 boolean으로 돌려준다 |
| `ensure` | 없으면 만들어 둔다          |

이름은 항상 긍정형으로 둔다 (`isActive` 는 OK, `isNotActive` 는 피한다). 부정 의미는 호출 쪽에서 `!isActive()` 로 적는 쪽이 더 깔끔하다.

### 1.6. 날짜와 시간 필드

시점을 다루는 필드는 접미어로 _어디까지 정밀한지_ 를 알 수 있게 한다.

- `xxxDate` — 달력 날짜만 (예: `releaseDate`, `birthDate`)
- `xxxAt` — 시·분·초 포함 timestamp (예: `createdAt`, `expiresAt`)

---

## 2. 에러 객체

각 도메인은 자기 에러 목록을 팩토리 함수들이 모인 객체로 정의한다. 상황마다 달라지는 값 (예: 어떤 이메일이 중복인지) 은 함수 인자로 받아 결과 객체에 같이 담는다.

```ts
export const UserErrors = {
    NotFound: () => ({ code: 'ERR_USER_NOT_FOUND', message: 'User does not exist.' }),
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_USER_EMAIL_ALREADY_EXISTS',
        message: 'Email is already registered.',
        email
    })
}
```

지켜야 할 약속은 다음과 같다.

- 에러 정의는 서비스 디렉토리 안의 `errors.ts` 파일로 따로 빼 둔다. 서비스 클래스 파일 안에 같이 적지 않는다.
- 같은 디렉토리의 `index.ts` 에서 `export * from './errors'` 로 다시 내보낸다.
- HTTP 4xx 응답에만 `code` 를 같이 보낸다. 5xx 는 서버 장애라서 클라이언트에 상세 원인을 보여 주지 않는다.
- `message` 는 디버깅과 로그에 쓰는 참고용일 뿐이다. 다국어 문구는 클라이언트가 `code` 를 보고 자기가 정한다.

---

## 3. Import 규칙

각 폴더에 `index.ts` (barrel export)를 두고 그 폴더의 공개 API를 한 곳에서 재수출한다. import는 _어디서 어디를 가리키는가_ 에 따라 두 가지 규칙이 다르다.

**자기보다 위에 있는 폴더는 상대 경로로 import 한다.** 절대 경로 (`tsconfig` 의 `paths` 별칭) 로 위 폴더를 부르면, 그 위 폴더가 또 자식들을 import 하면서 순환 참조가 생기기 쉽다.

```ts
/* core/users/users.service.ts */
import { AuthService } from '../auth' // O
import { AuthService } from 'core' // X — core 의 자식이 core 배럴을 거꾸로 참조하면 순환 참조 위험
```

**위쪽 줄기에 있지 않은 폴더는 절대 경로를 쓴다.** 이쪽은 상대 경로로 쓰면 `../../../` 처럼 길어져서 읽기 어려워진다.

```ts
/* gateway/users.http-controller.ts */
import { UsersService } from 'core' // O — gateway 에서 core 는 형제 묶음이라 별칭 사용
```

폴더마다 `index.ts` 를 두는 이유 중 하나는 사이클이 생겼을 때 빨리 드러나게 하려는 것이다. 모든 import 가 `index.ts` 를 거치면 의존 그래프가 단순해져서, 사이클이 생기는 순간 빌드 오류로 곧장 보인다.

---

## 4. REST API 설계

### 4.1. 리소스 중심 설계

URL 경로는 _행위_ 가 아니라 _리소스_ 를 기준으로 구성하고, 리소스 사이의 관계는 중첩 경로로 표현한다.

```
GET    /movies                    목록
GET    /movies/:id                조회
POST   /movies                    생성
PATCH  /movies/:id                수정
DELETE /movies/:id                삭제
GET    /movies/:id/showtimes      하위 리소스
```

다만 어떤 유스케이스는 여러 단계의 API 로 쪼개지는데, 그 단계들이 _그 유스케이스 안에서만_ 쓸모가 있는 경우가 있다. 이런 _복합 유스케이스_ 는 namespace 로 묶어서, 단독으로도 의미가 있는 API 와 구분한다.

```
# 복합 유스케이스 — namespace로 묶음
GET  /booking/movies/:id/theaters
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 다른 맥락에서도 단독으로 의미가 있음 — namespace 없이 둠
GET  /showtimes/:id
```

### 4.2. id-only API는 처음부터 복수형으로

ID만 받는 조회·삭제 API는 처음부터 복수형으로 설계한다. 단수로 시작했다가 나중에 벌크 처리가 필요해지면 API를 깨뜨려야 하기 때문이다. 생성·수정처럼 본문에 데이터를 받는 API는 단일 형태가 자연스럽다.

```ts
getMany(theaterIds: string[]) {}      // id만 받는 API — 복수형
deleteMany(theaterIds: string[]) {}

create(dto: CreateTheaterDto) {}      // 본문이 있는 API — 단일
update(dto: UpdateTheaterDto) {}
```

REST API에서 단일 항목을 다루는 엔드포인트가 필요하면, 컨트롤러가 배열로 감싸서 서비스의 복수형 메서드를 호출한다.

```ts
@Get(':id')
async get(@Param('id') id: string) {
    return this.service.getMany([id])
}
```

### 4.3. 시간이 오래 걸리는 작업은 비동기로

처리에 시간이 걸리는 작업은 곧바로 결과를 돌려주려 하지 않고, `202 Accepted` 와 sagaId를 먼저 응답한 뒤 진행 상황을 SSE로 흘려보낸다.

```
POST /some-resource         → 202 { sagaId }
GET  /some-resource/events  → SSE { status, sagaId }
```

### 4.4. 쿼리 파라미터가 길어질 가능성이 있으면 POST

GET의 쿼리 스트링은 길이 제한이 있고 일부 프록시에서 잘리기도 한다. 배열이나 긴 필터를 받는 검색 API는 처음부터 POST로 정의하는 편이 안전하다.

```
POST /showtimes/search
{ "theaterIds": [...] }
```

---

## 5. 데이터 비정규화

조회 성능을 높이고 _계층 사이 의존을 줄이려고_ 어느 정도 데이터를 중복해서 저장하는 것은 마다하지 않는다. 예를 들어 `Ticket` 에 `movieId` 와 `theaterId` 를 같이 저장해 두면, 티켓을 조회할 때마다 `ShowtimesService` 를 다시 부를 필요가 없다. 그 대신 두 값을 한 곳에서 항상 같이 갱신해야 하는 부담이 생긴다. 그 부담을 감수할 만한 자리에서는 중복 저장이 오히려 더 단순한 답이다.

---

## 6. Type vs Interface

기본은 `type` 이다. `interface` 는 클래스가 `implements` 해야 하거나, 선언 병합(declaration merging)으로 외부에서 확장될 가능성이 있는 자리에만 쓴다.

---

## 7. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙을 따른다. 위반하면 commit이 거절되므로 형식을 맞춰야 한다.

형식은 `type(scope): subject` 이고, 사용 가능한 type은 `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style` 이다.

예: `feat: add user login`, `fix(api): handle null pointer in auth`
