# 프로젝트 컨벤션

## 1. 네이밍 규칙

### 디렉토리: common vs shared

이 프로젝트에서 `common`과 `shared`는 서로 다른 범위를 가진다.

| 위치                          | 범위              | import 경로           | 내용                                    |
| ----------------------------- | ----------------- | --------------------- | --------------------------------------- |
| `libs/common/`                | 프로젝트 간 공유  | `@mannercode/common`  | Mongoose, Redis, JWT, S3, Logger, utils |
| `apps/*/src/config/`          | 앱 전체           | `'config'` (tsconfig) | AppConfig, Rules, Pipes, configureApp   |
| `apps/*/src/**/cores/shared/` | cores 레이어 내부 | 상대 경로             | 도메인 모델 (예: Seat)                  |

- `libs/common/` — 프로젝트 간 공유 인프라 유틸리티
- `src/config/` — 앱 전체 설정, 모듈, 파이프
- `cores/shared/` — 단일 아키텍처 레이어 내에서 공유되는 도메인 모델
- `cores/` 외부에 `shared` 디렉토리를 만들지 않는다. 더 넓은 범위의 공유가 필요하면 `config`나 패키지로 이동한다.

### 파일 네이밍

| 유형                    | 패턴                          | 예시                                    |
| ----------------------- | ----------------------------- | --------------------------------------- |
| DTO                     | `[action-entity].dto.ts`      | `create-customer.dto.ts`                |
| 페이지네이션 검색 DTO   | `search-[entity].page.dto.ts` | `search-customers.page.dto.ts`          |
| 비페이지네이션 검색 DTO | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| 결과 (동기 벌크 연산)   | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| 응답 (비동기 요청 응답) | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| 모델                    | `[entity].ts`                 | `customer.ts`                           |
| 에러                    | `errors.ts`                   | `errors.ts`                             |
| 클라이언트 (MSA)        | `[service].client.ts`         | `customers.client.ts`                   |

### 클래스 & DTO 네이밍

- **DTO**: `[Action][Entity]Dto` — `CreateCustomerDto`, `SearchMoviesPageDto`
- **엔티티 DTO**: `[Entity]Dto` — `CustomerDto`, `TicketDto`
- **결과**: `[Action][Entity]Result` — `CreateShowtimesResult`
- **응답**: `[Action]Response` — `RequestShowtimeCreationResponse`
- **에러 상수**: `[Entity]Errors` — `CustomerErrors`, `BookingErrors`

### 메서드 네이밍

| 메서드             | 용도                         | 반환                          |
| ------------------ | ---------------------------- | ----------------------------- |
| `create`           | 단일 생성                    | `EntityDto`                   |
| `createMany`       | 벌크 생성                    | `Create[Entity]Result`        |
| `getMany`          | ID로 조회 (모두 존재해야 함) | `EntityDto[]`                 |
| `search`           | 비페이지네이션 필터 조회     | `EntityDto[]`                 |
| `searchPage`       | 페이지네이션 조회            | `PaginationResult<EntityDto>` |
| `search[Field]`    | 특정 필드만 반환             | `string[]`, `Date[]`          |
| `update`           | 단일 수정                    | `EntityDto`                   |
| `updateStatusMany` | 벌크 상태 변경               | `EntityDto[]`                 |
| `deleteMany`       | ID로 삭제                    | `void`                        |
| `allExist`         | 모든 ID 존재 확인            | `boolean`                     |
| `anyExist`         | 하나라도 존재 확인           | `boolean`                     |
| `exists`           | 단일 ID 존재 확인            | `boolean`                     |

**Repository 전용** (Client로 노출하지 않음):

- `findById` / `findByIds` — nullable 반환, 호출자가 처리
- `getById` / `getByIds` — 없으면 `NotFoundException` throw

### 서비스 이름

프로세스 중심 서비스는 단수형, 엔티티 관리 서비스는 복수형으로 명명한다.

| 유형               | 예시                                | 설명                 |
| ------------------ | ----------------------------------- | -------------------- |
| 프로세스 (단수)    | `BookingService`, `PurchaseService` | 특정 프로세스를 처리 |
| 엔티티 관리 (복수) | `MoviesService`, `TheatersService`  | 엔티티 CRUD 담당     |

`Service` suffix는 **다른 서비스를 직접 호출해 스스로 처리하는 경우**에만 붙인다. 필요한 데이터를 호출자에게 전달받아 계산만 수행하는 경우에는 suffix를 붙이지 않는다.

```
ShowtimeBulkValidatorService  ← Showtimes/Movies/Theaters 서비스를 직접 호출
ShowtimeBulkValidator         ← 호출자가 데이터를 주입하면 검증 계산만 수행
```

### Predicate 함수

| 접두어       | 용도                | 예시               |
| ------------ | ------------------- | ------------------ |
| **`is`**     | 상태 확인           | `isPublished()`    |
| **`has`**    | 소유 여부           | `hasMoviePoster()` |
| **`can`**    | 권한/가능 여부      | `canActivate()`    |
| **`should`** | 규칙 기반 권장 여부 | `shouldArchive()`  |

긍정형으로 네이밍한다. (`isActive` O, `isNotActive` X)

### 검증 함수

| 동사         | 용도                                     |
| ------------ | ---------------------------------------- |
| **`verify`** | 확인하고, 실패 시 예외 throw             |
| **`check`**  | 결과를 boolean으로 반환 (검사 행위 강조) |
| **`ensure`** | 없으면 생성                              |

### 날짜/시간 필드

| 접미어        | 의미                                 | 예시                       |
| ------------- | ------------------------------------ | -------------------------- |
| **`xxxDate`** | 달력상의 날짜 (YYYY-MM-DD)           | `releaseDate`, `birthDate` |
| **`xxxAt`**   | 특정 시점 (timestamp, 시/분/초 포함) | `createdAt`, `expiresAt`   |

### 생성자 파라미터

- **Client/Service**: 타입의 camelCase 그대로 — `ticketsClient: TicketsClient`, `paymentsClient: PaymentsClient`
- **Repository**: 서비스당 하나일 때 `repository` — `repository: CustomersRepository`
- **Controller**: 항상 `service` — `service: CustomersService`
- **Client proxy**: 항상 `proxy` — `proxy: ClientProxyService`

### 이벤트 키

- 이벤트 키는 camelCase를 사용한다: `Events.Purchase.ticketPurchased`, `Events.Purchase.ticketPurchaseCanceled`

---

## 2. 에러 객체

각 항목은 에러 객체를 반환하는 팩토리 함수다. 컨텍스트별 필드는 파라미터로 전달하고 `code`, `message`와 함께 반환한다.

```typescript
export const [Entity]Errors = {
    // 추가 컨텍스트 없음
    ErrorKey: () => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.'
    }),
    // 컨텍스트 파라미터 포함
    ErrorKeyWithContext: (param: type) => ({
        code: 'ERR_[ENTITY]_[SPECIFIC_ERROR]',
        message: 'Human-readable description.',
        param
    })
}
```

- 에러 상수(`[Entity]Errors`)는 서비스 디렉토리의 별도 `errors.ts` 파일에 정의한다.
- 서비스 클래스 파일 내에 인라인으로 정의하지 않는다.
- 서비스 디렉토리의 `index.ts`에서 재수출한다: `export * from './errors'`

---

## 3. Client ↔ Service 대칭

Client 메서드는 Service 메서드와 동일하게 구성한다 (같은 이름, 같은 파라미터 순서). Client는 `proxy.request()`를 래핑한다.

### Client 반환 패턴

- **값 반환**: `return this.proxy.request(...)` — `async`/`await` 없이
- **Void**: `async method() { await this.proxy.request(...) }` — `async`/`await` 필수

---

## 4. Type vs Interface

기본적으로 `type`을 사용한다. `interface`는 클래스가 구현(implements)하거나 외부 확장(declaration merging)이 필요한 경우에 사용한다.

| 상황                                  | 선택        |
| ------------------------------------- | ----------- |
| 앱 내부 고정 데이터 구조              | `type`      |
| 타입 연산 (유니온/매핑/조건부)        | `type`      |
| 클래스가 구현해야 하는 계약           | `interface` |
| 패키지 퍼블릭 타입 (소비자 확장 허용) | `interface` |

---

## 5. Import 규칙

각 폴더에 `index.ts`(barrel export)를 두어 공개 API를 재수출한다. 순환 참조를 방지하기 위해 다음 규칙을 따른다.

- **직계 조상 폴더**는 **상대 경로**로 import한다.

    ```ts
    /* users.service.ts */

    // (X) 순환 참조 발생 가능
    import { AuthService } from 'src/services'

    // (O) 상대 경로로 참조
    import { AuthService } from '../auth'
    ```

- **직계 조상이 아닌 폴더**는 **절대 경로**를 사용한다.

    ```ts
    /* users.controller.ts */

    // (O) 절대 경로 사용
    import { AuthService } from 'src/services'

    // (X) 상대 경로로는 권장하지 않음
    import { AuthService } from '../services'
    ```

> 폴더마다 `index.ts`를 두면 순환 참조를 더 빨리 발견할 수 있다.

---

## 6. 주석 스타일

```ts
// 한 줄은 이렇게 한다.

/**
 * 두 줄 이상은 이렇게 한다.
 */
```

`/* ... */` 형태(별표 없는 블록 주석)는 사용하지 않는다. 편집기에서 자동 정렬이 되지 않는다.

---

## 7. 커밋 메시지

`@commitlint/config-conventional` 규칙을 사용한다. 커밋 메시지는 아래 형식을 따라야 하며, 위반 시 커밋이 실패한다.

**형식**: `type: subject` 또는 `type(scope): subject`

| type       | 용도                          |
| ---------- | ----------------------------- |
| `feat`     | 기능 추가                     |
| `fix`      | 버그 수정                     |
| `docs`     | 문서 변경                     |
| `style`    | 코드 의미 변화 없는 포맷 변경 |
| `refactor` | 리팩터링                      |
| `perf`     | 성능 개선                     |
| `test`     | 테스트 추가/수정              |
| `build`    | 빌드/의존성 관련              |
| `ci`       | CI 설정/스크립트 변경         |
| `chore`    | 기타 잡무                     |
| `revert`   | 되돌리기                      |

예: `feat: add user login`, `fix(api): handle null pointer in auth`
