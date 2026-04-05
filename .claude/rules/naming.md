---
paths:
    - 'libs/*/src/**/*.ts'
    - 'apps/*/src/**/*.ts'
---

# 네이밍 규칙

## 파일 네이밍

| 유형                    | 패턴                          | 예시                                    |
| ----------------------- | ----------------------------- | --------------------------------------- |
| DTO                     | `[action-entity].dto.ts`      | `create-customer.dto.ts`                |
| 페이지네이션 검색 DTO   | `search-[entity].page.dto.ts` | `search-customers.page.dto.ts`          |
| 비페이지네이션 검색 DTO | `search-[entity].dto.ts`      | `search-showtimes.dto.ts`               |
| 결과 (동기 벌크)        | `[action-entity].result.ts`   | `create-tickets.result.ts`              |
| 응답 (비동기 요청)      | `[action-entity].response.ts` | `request-showtime-creation.response.ts` |
| 모델                    | `[entity].ts`                 | `customer.ts`                           |
| 에러                    | `errors.ts`                   | `errors.ts`                             |
| 클라이언트 (MSA)        | `[service].client.ts`         | `customers.client.ts`                   |

## 클래스 & DTO 네이밍

- DTO: `[Action][Entity]Dto` — `CreateCustomerDto`
- 엔티티 DTO: `[Entity]Dto` — `CustomerDto`
- 결과: `[Action][Entity]Result` — `CreateShowtimesResult`
- 응답: `[Action]Response` — `RequestShowtimeCreationResponse`
- 에러 상수: `[Entity]Errors` — `CustomerErrors`

## 메서드 네이밍

| 메서드       | 용도                         | 반환                          |
| ------------ | ---------------------------- | ----------------------------- |
| `create`     | 단일 생성                    | `EntityDto`                   |
| `createMany` | 벌크 생성                    | `Create[Entity]Result`        |
| `getMany`    | ID로 조회 (모두 존재해야 함) | `EntityDto[]`                 |
| `search`     | 비페이지네이션 필터 조회     | `EntityDto[]`                 |
| `searchPage` | 페이지네이션 조회            | `PaginationResult<EntityDto>` |
| `update`     | 단일 수정                    | `EntityDto`                   |
| `deleteMany` | ID로 삭제                    | `void`                        |

Repository 전용 (Client로 노출하지 않음):

- `findById` / `findByIds` — nullable 반환
- `getById` / `getByIds` — 없으면 `NotFoundException` throw

## 서비스 이름

- 프로세스 중심 → 단수: `BookingService`, `PurchaseService`
- 엔티티 관리 → 복수: `MoviesService`, `TheatersService`

## 생성자 파라미터

- Client/Service: 타입의 camelCase — `ticketsClient: TicketsClient`
- Repository: `repository` — `repository: CustomersRepository`
- Controller: `service` — `service: CustomersService`
- Client proxy: `proxy` — `proxy: ClientProxyService`

## Type vs Interface

기본 `type`. `interface`는 클래스 구현(implements)이나 외부 확장이 필요할 때만.

## 주석 스타일

```ts
// 한 줄은 이렇게 한다.

/**
 * 두 줄 이상은 이렇게 한다.
 */
```

`/* ... */` 형태(별표 없는 블록 주석)는 사용하지 않는다.
