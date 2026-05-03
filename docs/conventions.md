# 컨벤션

## 1. 네이밍

### 디렉토리: `common` vs `shared`

| 위치                         | 범위              | import 경로          |
| ---------------------------- | ----------------- | -------------------- |
| `libs/common/`               | 프로젝트 간 공유  | `@mannercode/common` |
| `apps/*/src/config/`         | 앱 전체           | `'config'`           |
| `apps/*/src/**/cores/shared/` | cores 레이어 내부 | 상대 경로            |

`cores/` 외부에 `shared` 디렉토리를 만들지 않는다. 더 넓은 범위가 필요하면 `config`나 패키지로 이동.

### 파일

| 유형                    | 패턴                          | 예시                                    |
| ----------------------- | ----------------------------- | --------------------------------------- |
| DTO                     | `[action-entity].dto.ts`      | `create-user.dto.ts`                    |
| 페이지네이션 검색 DTO   | `search-[entity].page.dto.ts` | `search-users.page.dto.ts`              |
| 비페이지네이션 검색 DTO | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| 결과 (동기 벌크)        | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| 응답 (비동기 요청)      | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| 모델                    | `[entity].ts`                 | `user.ts`                               |
| 에러                    | `errors.ts`                   | `errors.ts`                             |

### 메서드

| 메서드             | 용도                       | 반환                          |
| ------------------ | -------------------------- | ----------------------------- |
| `create`           | 단일 생성                  | `EntityDto`                   |
| `createMany`       | 벌크 생성                  | `Create[Entity]Result`        |
| `getMany`          | ID 조회 (모두 존재해야 함) | `EntityDto[]`                 |
| `search`           | 비페이지네이션 필터        | `EntityDto[]`                 |
| `searchPage`       | 페이지네이션               | `PaginationResult<EntityDto>` |
| `update`           | 단일 수정                  | `EntityDto`                   |
| `deleteMany`       | ID 삭제                    | `void`                        |
| `allExist` / `anyExist` / `exists` | 존재 확인        | `boolean`                     |

**Repository 전용** (Service로 노출하지 않음):
- `findById` / `findByIds` — nullable, 호출자가 처리
- `getById` / `getByIds` — 없으면 `NotFoundException`

### 서비스

| 유형               | 예시                                | 설명                 |
| ------------------ | ----------------------------------- | -------------------- |
| 프로세스 (단수)    | `BookingService`, `PurchaseService` | 특정 프로세스 처리   |
| 엔티티 관리 (복수) | `MoviesService`, `TheatersService`  | 엔티티 CRUD          |

`Service` suffix는 **다른 서비스를 직접 호출해 스스로 처리하는 경우**에만 붙인다. 데이터를 주입받아 계산만 하면 suffix 없음.

```
ShowtimeBulkValidatorService  ← Showtimes/Movies/Theaters 서비스 직접 호출
ShowtimeBulkValidator         ← 호출자가 데이터 주입, 검증 계산만
```

### Predicate / 검증

| 접두어   | 용도                |
| -------- | ------------------- |
| `is`     | 상태 확인           |
| `has`    | 소유 여부           |
| `can`    | 권한/가능 여부      |
| `should` | 규칙 기반 권장      |
| `verify` | 실패 시 예외 throw  |
| `check`  | boolean 반환        |
| `ensure` | 없으면 생성         |

긍정형으로 네이밍 (`isActive` O, `isNotActive` X).

### 날짜/시간 필드

- `xxxDate` — 달력 날짜 (`releaseDate`, `birthDate`)
- `xxxAt` — timestamp (`createdAt`, `expiresAt`)

---

## 2. 에러 객체

각 항목은 에러 객체를 반환하는 팩토리 함수다. 컨텍스트별 필드는 파라미터로 전달한다.

```ts
export const UserErrors = {
    NotFound: () => ({
        code: 'ERR_USER_NOT_FOUND',
        message: 'User does not exist.'
    }),
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_USER_EMAIL_ALREADY_EXISTS',
        message: 'Email is already registered.',
        email
    })
}
```

- `errors.ts` 별도 파일로 분리. 서비스 클래스에 인라인 정의 금지.
- `index.ts`에서 재수출: `export * from './errors'`
- HTTP 4xx에만 `code` 포함. 5xx는 서버 장애라 클라이언트에 상세 노출하지 않는다.
- `message`는 참고용. 다국어 지원은 클라이언트 책임.

---

## 3. Import 규칙

각 폴더에 `index.ts`(barrel export)를 두어 공개 API를 재수출한다.

- **직계 조상 폴더**는 **상대 경로**로 import (절대 경로는 순환 참조 가능)

    ```ts
    /* users.service.ts */
    import { AuthService } from '../auth'        // O
    import { AuthService } from 'src/services'   // X — 순환 참조 위험
    ```

- **직계 조상이 아닌 폴더**는 **절대 경로**

    ```ts
    /* users.controller.ts */
    import { AuthService } from 'src/services'   // O
    ```

---

## 4. REST API 설계

### 리소스 중심

```
GET    /movies                    목록
GET    /movies/:id                조회
POST   /movies                    생성
PATCH  /movies/:id                수정
DELETE /movies/:id                삭제
GET    /movies/:id/showtimes      하위 리소스
```

**복합 유스케이스**에는 namespace 사용. 복합이란 하나의 상위 유스케이스가 여러 하위 API로 분해되고, 각 하위 API가 그 맥락 밖에서는 단독 사용되지 않는 경우.

```
# 복합 — namespace
GET  /booking/movies/:id/theaters
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 단독으로 의미 있음 — namespace 없음
GET  /showtimes/:id
```

### id-only API는 처음부터 복수형

나중에 복수 처리가 필요해져서 API를 변경하는 것을 방지한다.

```ts
getMany(theaterIds: string[]) {}      // id만 받는 API — 복수형
deleteMany(theaterIds: string[]) {}

create(dto: CreateTheaterDto) {}       // 생성/수정은 단일
update(dto: UpdateTheaterDto) {}
```

단일 요청은 컨트롤러에서 배열로 감싼다.

```ts
@Get(':id')
async get(@Param('id') id: string) {
    return this.service.getMany([id])
}
```

### 비동기 요청

처리 시간이 긴 작업은 `202 Accepted` + SSE.

```
POST /some-resource         → 202 { sagaId }
GET  /some-resource/events  → SSE { status, sagaId }
```

### 긴 쿼리 파라미터는 POST

```
POST /showtimes/search
{ "theaterIds": [...] }
```

---

## 5. 데이터 비정규화

조회 성능과 **계층 간 결합 감소**를 위해 적절히 비정규화. `Ticket`에 `movieId` · `theaterId`를 중복 저장하면 조회 시마다 `ShowtimesService`를 호출할 필요가 없다.

---

## 6. Type vs Interface

기본 `type`. `interface`는 클래스가 `implements`하거나 declaration merging이 필요할 때만.

---

## 7. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙. 위반 시 commit 실패.

`type(scope): subject` — `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style`.

예: `feat: add user login`, `fix(api): handle null pointer in auth`
