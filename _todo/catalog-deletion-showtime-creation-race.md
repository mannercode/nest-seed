# 영화·극장 삭제와 상영 생성의 경합 보장

> 작성일: 2026-09-03  
> 상태: 문제와 권장 설계 정리 완료, 구현 전  
> 범위: `DELETE /movies/:movieId`·`DELETE /theaters/:theaterId`와
> `showtime-creation`의 `validate and create`가 동시에 실행되는 경우

## 결론

현재 코드는 이미 커밋된 상영이 있으면 영화·극장 삭제를 409로 거부한다. 그러나
“상영 참조 확인”과 “부모 삭제”가 하나의 transaction이 아니므로, 확인 직후 다른
요청이 상영을 생성하면 삭제와 생성이 모두 성공할 수 있다. Gateway에서 이 로직을
Application의 `CatalogManagementService`로 옮긴 것은 책임 위치를 바로잡은 것이지
동시성 보장을 추가한 것은 아니다.

보장해야 할 결과는 다음 둘 중 하나다.

1. 상영 생성이 먼저 확정되면 삭제는 409로 끝나고 영화·극장은 남는다.
2. 삭제가 먼저 확정되면 상영 생성은 부모 없음으로 끝나고 상영·티켓을 남기지 않는다.

삭제와 생성이 모두 성공해 활성 상영이 삭제된 영화나 극장을 참조하는 결과는 없어야
한다. 이를 보장하려면 두 경로가 **같은 부모 문서를 transaction 안에서 먼저 쓰도록**
만들어 MongoDB write conflict의 대상이 되게 해야 한다.

권장안은 다음과 같다.

- 상영 생성 transaction은 영화 문서와 극장 문서를 먼저 guard 갱신한다.
- 삭제도 부모 문서를 먼저 논리 삭제한 뒤, 같은 transaction과 session으로 상영 참조를
  조회한다. 참조가 있으면 409를 던져 transaction 전체를 rollback한다.
- 영화의 S3 asset 삭제는 MongoDB transaction 안에서 실행하지 않는다. 논리 삭제와
  cleanup 작업을 transaction으로 확정한 뒤, 멱등한 후속 작업으로 정리한다.

## 1. 지켜야 하는 불변식

여기서 “활성”은 soft delete 문서의 `deletedAt`이 `null`인 상태를 뜻한다. showtime은
hard delete 컬렉션이므로 존재하는 모든 showtime이 활성 참조다.

```txt
모든 커밋된 showtime S에 대해

activeMovie(S.movieId) = true
activeTheater(S.theaterId) = true
```

API 결과로 바꾸면 다음과 같다.

| 경합 승자 | 영화·극장 DELETE | 상영 생성 최종 상태 | 커밋된 데이터                    |
| --------- | ---------------- | ------------------- | -------------------------------- |
| 상영 생성 | `409 Conflict`   | `succeeded`         | 부모와 상영·티켓 모두 존재       |
| 삭제      | `204 No Content` | 부모 없음 `error`   | 부모는 비활성, 새 상영·티켓 없음 |

현재 `showtime-creation` 계약에서 기존 상영과의 시간 충돌만 `failed`이고, 영화·극장
없음은 terminal exception을 거쳐 `error`가 된다. 이 상태 구분을 바꾸는 것은 race
해결에 필수는 아니다.

이미 삭제된 ID를 다시 삭제하는 기존 멱등 계약은 그대로 204를 반환할 수 있다. 다만
동시에 생성된 상영이 먼저 커밋됐다면 “이미 확인했으니 삭제”가 아니라 409가 되어야
한다.

## 2. 현재 코드가 보장하는 범위

삭제 경로는 다음 두 호출로 나뉜다.

```txt
CatalogManagementService.deleteMovie/deleteTheater
    1. ShowtimesService.existsByMovieIds/existsByTheaterIds
    2. MoviesService.deleteMany/TheatersService.deleteMany
```

두 호출은 session을 공유하지 않는다. 영화 삭제는 그 사이에 asset 조회와 S3 삭제까지
수행하므로 race window가 더 길다.

상영 생성 경로는 하나의 MongoDB transaction 안에서 다음 순서로 실행된다.

```txt
ShowtimeCreationPersistenceService.validateAndCreate
    1. 대상 극장의 showtimeScheduleVersion 갱신
    2. 영화 존재 확인과 기존 상영 충돌 조회
    3. showtime·ticket·operation 삽입
    4. commit
```

극장 guard는 같은 극장에 상영을 만드는 **생성 대 생성** 경합은 직렬화한다. 그러나
현재 삭제의 참조 확인은 이 transaction 밖에서 이미 끝났기 때문에 생성 대 삭제까지
보장하지는 않는다. 영화 존재 확인은 읽기뿐이라 영화 문서에는 write conflict 지점도
없다.

관련 코드:

- [`CatalogManagementService`](../apps/api/src/services/application/catalog-management/catalog-management.service.ts)
- [`ShowtimeCreationPersistenceService`](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts)
- [`ShowtimeBulkValidatorService`](../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts)
- [`TheatersRepository.acquireShowtimeScheduleGuards`](../apps/api/src/services/core/theaters/theaters.repository.ts)
- [`MoviesService.deleteMany`](../apps/api/src/services/core/movies/movies.service.ts)
- [`ShowtimesRepository`](../apps/api/src/services/core/showtimes/showtimes.repository.ts)

## 3. 실제로 가능한 실패 순서

### 영화

| 순서 | 삭제 요청                    | 상영 생성 transaction                                   |
| ---- | ---------------------------- | ------------------------------------------------------- |
| 1    | showtime 없음 확인           |                                                         |
| 2    |                              | movie가 활성이라고 읽음                                 |
| 3    | movie를 soft delete하고 성공 |                                                         |
| 4    |                              | 과거 snapshot을 바탕으로 showtime·ticket 삽입 후 commit |

상영 생성은 movie 문서를 읽기만 하고 다른 컬렉션을 쓴다. transaction 안의 read도 다른
쓰기 이후에는 stale snapshot일 수 있으므로, movie가 삭제됐다는 사실만으로 transaction이
자동 중단된다고 가정할 수 없다.

### 극장

| 순서 | 삭제 요청                             | 상영 생성 transaction                            |
| ---- | ------------------------------------- | ------------------------------------------------ |
| 1    | showtime 없음 확인                    |                                                  |
| 2    |                                       | theater guard 갱신으로 부모 문서 write lock 획득 |
| 3    | theater soft delete 시도 후 대기      | showtime·ticket 삽입 후 commit                   |
| 4    | lock 해제 뒤 theater soft delete 성공 |                                                  |

transaction이 먼저 부모 문서를 쓰면 transaction 밖의 동일 문서 쓰기는 transaction이
끝날 때까지 기다릴 수 있다. 기다리던 삭제는 생성 commit 뒤 참조를 다시 확인하지
않으므로 결국 두 요청이 모두 성공할 수 있다.

MongoDB 공식 문서도 transaction의 일반 read가 stale document를 볼 수 있으며, 최신
상태와 쓰기 충돌을 강제하려면 `findOneAndUpdate`처럼 문서를 실제로 수정해야 한다고
설명한다. Node.js driver의 `withTransaction` callback API는
`TransientTransactionError`와 불확실한 commit 결과를 재시도한다.

- [MongoDB transaction의 write conflict와 stale read](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/#in-progress-transactions-and-write-conflicts)
- [MongoDB Node.js driver transaction과 자동 재시도](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/)

## 4. 권장 설계

### 4.1 부모 문서를 공통 직렬화 지점으로 쓴다

극장에는 이미 `showtimeScheduleVersion`이 있다. 영화에도 내부 필드
`showtimeReferenceVersion`을 두고, 상영 생성 transaction이 `$inc`한다. 기존 문서에
필드가 없어도 MongoDB `$inc`가 필드를 만들 수 있으므로 seed의 과거 데이터 migration을
별도로 만들 필요는 없다.

상영 생성 순서는 다음처럼 바꾼다.

```ts
await moviesService.acquireShowtimeReferenceGuard(movieId, session, signal)
await theatersService.acquireShowtimeScheduleGuards(theaterIds, session, signal)

// 그 뒤에 기존 상영 검증과 showtime·ticket·operation 삽입
```

guard 갱신은 반드시 `deletedAt: null`인 부모만 대상으로 한다. 갱신 수가 기대한 ID 수와
다르면 부모 없음 오류로 끝낸다. 영화 guard가 존재 확인도 겸하므로 현재의 read-only
`allExist`는 제거하거나 방어적 확인으로만 남길 수 있다.

항상 movie guard를 먼저, theater guard를 다음에 얻는 호출 순서를 유지한다. 한
transaction 안의 MongoDB 명령은 `Promise.all`로 병렬 실행하지 않는다.

### 4.2 삭제도 transaction 안에서 부모부터 쓴다

삭제는 “참조 조회 후 부모 쓰기”가 아니라 **“부모 쓰기 후 참조 조회”** 순서여야 한다.
먼저 soft delete를 수행해 상영 생성과 같은 문서에서 충돌하게 만들고, 참조가 발견되면
예외를 던져 그 soft delete를 rollback한다.

```ts
await session.withTransaction(async () => {
    const deleted = await parents.softDelete(parentId, session)
    if (!deleted) return // 이미 삭제된 ID의 멱등 성공

    if (await showtimes.existsByParentId(parentId, session)) {
        throw new ConflictException(/* 기존 오류 계약 */)
    }
})
```

모든 조회와 쓰기에 **같은 `ClientSession`을 명시적으로 전달**해야 한다. callback 안에
코드를 넣었더라도 `existsByMovieIds`가 session 없이 실행되면 transaction 보장이
생기지 않는다.

두 경로가 같은 부모를 먼저 쓰면 결과는 다음처럼 수렴한다.

- 생성이 부모 guard를 먼저 썼다: 삭제 transaction이 충돌 후 재시도되고, 새 snapshot에서
  showtime을 찾아 409를 반환한다. 삭제 write는 rollback된다.
- 삭제가 부모를 먼저 썼다: 생성 transaction이 충돌 후 재시도되고, active 부모를 찾지
  못해 상영·티켓 없이 끝난다.

Application에서 transaction을 시작하는 방식은 현재 `PurchaseService`처럼
`MongoConnection`을 주입해도 된다. transaction option과 timeout은 기존 상영 생성
transaction과 같은 정책을 재사용하되, 공통 상수나 helper를 둘지는 구현 시 중복 정도를
보고 결정한다.

### 4.3 조회용 index를 보강한다

삭제 transaction 안의 참조 조회는 짧아야 한다. 현재 showtime index는
`{ theaterId: 1, startTime: 1 }`와 `{ sagaId: 1 }`뿐이다.

- `existsByTheaterIds`는 기존 compound index의 `theaterId` prefix를 사용할 수 있다.
- `existsByMovieIds`를 위해 `{ movieId: 1 }` index를 추가한다.

실제 `explain`으로 두 조회가 `COLLSCAN`이 아닌지 확인한다. index가 없으면 movie 삭제가
showtimes 전체를 훑는 동안 transaction과 부모 write lock이 불필요하게 길어진다.

## 5. 영화 asset 삭제는 별도로 풀어야 한다

`MoviesService.deleteMany`는 현재 movie를 soft delete하기 전에 S3 객체와 asset DB 행을
삭제한다. 이 코드를 그대로 `withTransaction` callback 안으로 옮기면 안 된다.

- S3 삭제는 MongoDB rollback으로 되돌릴 수 없다.
- `withTransaction` callback은 write conflict 때 다시 실행될 수 있다.
- 외부 I/O가 transaction과 lock을 오래 잡게 된다.
- asset을 먼저 지운 뒤 참조를 발견해 409를 반환하면, 살아 있는 movie가 사라진 이미지를
  계속 가리키게 된다.

권장 흐름은 MongoDB 상태 확정과 외부 정리를 분리하는 것이다.

```txt
MongoDB transaction
    movie soft delete
    showtime 참조 확인 — 있으면 전체 rollback
    삭제할 asset ID를 담은 cleanup operation 저장
commit

transaction 밖
    S3 object와 asset DB 행을 멱등 삭제
    cleanup operation 완료 표시
```

API의 기존 체감을 유지하려면 첫 cleanup은 요청 안에서 즉시 실행하고, 성공한 뒤 204를
반환한다. 다만 DB commit 뒤 프로세스가 종료되거나 S3가 실패해도 남은 operation을 다음
DELETE 재시도나 주기 reconciler가 이어서 처리해야 한다. 이미 soft delete된 movie만 보고
곧바로 204를 반환하면 pending cleanup을 영원히 잃을 수 있다.

cleanup operation에는 최소한 다음 정보가 필요하다.

```txt
kind = movie-assets
resourceId = movieId
candidateAssetIds
status = pending | completed
unique(kind, resourceId)
```

현재 코드처럼 cleanup 시점에 asset owner를 다시 확인해 다른 movie 소유 asset은 지우지
않아야 한다. S3 `DeleteObject`와 soft delete는 재실행 가능한 동작이어야 한다. MongoDB
transaction callback 안에서는 operation 기록까지만 만들고 실제 S3 호출은 하지 않는다.

### 인접한 asset race

movie 삭제는 `createAsset`·`finalizeUpload`와도 경합할 수 있다. 예를 들어
`finalizeUpload`가 movie 존재를 읽은 뒤 삭제가 커밋되면, asset owner만 설정되고 movie
연결 갱신은 active filter에 걸려 무음 no-op이 될 수 있다. showtime 참조 race만 고치면
이 문제까지 자동으로 해결되지는 않는다.

따라서 movie 삭제를 “모든 동시 쓰기에 대해 안전하다”고 문서화하려면 다음도 함께
검토해야 한다.

- `addAsset`·pending asset 연결이 실제로 부모 한 건을 갱신했는지 결과를 확인한다.
- 삭제된 부모에 연결하지 못한 asset은 즉시 삭제하거나 durable cleanup에 넣는다.
- 삭제와 asset 연결도 같은 movie guard 또는 명시적인 deletion 상태를 공유한다.

이는 showtime 참조 불변식과는 별도지만, movie 삭제 흐름을 transaction화할 때 같이
드러나는 필수 후속 항목이다.

## 6. 채택하지 않을 단순 해법

| 해법                             | 채택하지 않는 이유                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Application 계층으로 옮기기만 함 | 책임 위치만 바뀌며 두 DB 연산 사이 race window는 그대로다.                                                    |
| 삭제 직전에 한 번 더 조회        | 마지막 조회와 삭제 사이에 다시 생성할 수 있다. 선형화 지점이 없다.                                            |
| 삭제만 transaction으로 묶음      | movie 생성 경로가 부모를 읽기만 하면 stale snapshot/write skew를 막지 못한다.                                 |
| 현재 theater guard에만 의존      | transaction 밖 삭제가 기다린 뒤 재검증 없이 성공할 수 있다. movie guard도 없다.                               |
| Redis 분산 락                    | TTL 만료·장애·누락된 호출 경로가 정합성 오류가 된다. DB 불변식은 MongoDB write conflict로 보장하는 편이 맞다. |
| showtime unique index            | unique index는 중복 상영 일부를 막을 수 있지만 다른 collection의 부모 삭제는 막지 못한다.                     |
| 삭제 후 재조회·보상              | 이미 204를 응답하거나 S3를 삭제한 뒤라면 원상 복구가 불완전하고, 중간의 dangling 상태도 노출된다.             |

별도 guard collection을 만들어 movie·theater 대신 그 문서를 공통으로 갱신하는 방법도
가능하다. 그러나 현재 theater 문서가 이미 같은 역할을 하고 있고, parent의 active 여부와
guard 생명주기를 두 collection에 맞춰야 하므로 지금 구조에서는 부모 문서 자체를 쓰는
편이 단순하다. 서비스가 서로 다른 DB로 분리되는 시점에는 MongoDB transaction 자체를
쓸 수 없으므로, 그때는 owning service의 상태 전이와 durable message 기반 프로토콜로
다시 설계해야 한다.

## 7. 구현 파일 후보

1. `MoviesRepository`·`MoviesService`
    - session을 받는 `acquireShowtimeReferenceGuard` 추가
    - 내부 `showtimeReferenceVersion` 갱신
    - movie DB 삭제와 외부 asset cleanup 분리
2. `TheatersService`
    - `deleteMany` 또는 전용 soft-delete 메서드에 session 전달
    - 기존 `showtimeScheduleVersion` guard 유지
3. `ShowtimesRepository`·`ShowtimesService`
    - `existsByMovieIds`·`existsByTheaterIds`에 session과 abort signal 전달
    - `{ movieId: 1 }` index 추가
4. `ShowtimeCreationPersistenceService`
    - theater guard보다 앞에 movie guard 추가
5. `CatalogManagementService`
    - `MongoConnection`으로 transaction 시작
    - 부모 write → showtime 참조 조회 순서 구현
6. movie asset cleanup operation과 reconciler
    - operation unique key와 멱등 재실행
    - 요청 중 첫 실행, 실패·중단 시 후속 복구

Core repository를 Application에서 직접 import하지 않는다. session-aware 동작은 각 Core
Service의 공개 메서드로 노출하고 `CatalogManagementService`가 조정한다.

## 8. 검증 계획

확률적인 `Promise.all` 반복만으로는 원하는 interleaving이 실제로 발생했는지 알 수 없다.
spy와 Promise barrier로 두 transaction의 정확한 지점을 멈추는 deterministic 통합
테스트를 먼저 둔다. mock DB로 바꾸지 않고 실제 Replica Set을 사용한다.

movie와 theater 각각 다음 두 경우가 필요하다.

### 생성이 먼저 이기는 경우

1. 상영 생성이 parent guard를 쓴 직후 commit 전에서 멈춘다.
2. 삭제를 시작한다.
3. 생성을 계속해 commit한다.
4. 삭제가 409인지 확인한다.
5. 부모가 활성이고 showtime·ticket이 정확히 한 세트인지 확인한다.

### 삭제가 먼저 이기는 경우

1. 삭제 transaction이 부모를 쓴 직후 참조 조회 전에서 멈춘다.
2. 상영 생성을 시작한다.
3. 삭제를 계속해 commit한다.
4. 상영 생성의 최종 상태가 부모 없음 `error`인지 확인한다.
5. 부모가 비활성이고 새 showtime·ticket이 하나도 없는지 확인한다.

추가 검증:

- transaction callback 재시도 횟수보다 최종 HTTP/status와 DB 불변식을 단언한다.
- movie asset cleanup이 한 번 실패해도 pending operation이 남고 다음 실행에서 완료되는지
  검증한다.
- DB commit 직후 cleanup을 건너뛴 crash 상황도 reconciler가 복구하는지 검증한다.
- 같은 cleanup을 두 replica가 동시에 실행해도 다른 owner의 asset을 지우지 않고 한 완료
  상태로 수렴하는지 검증한다.
- 단일 process 통합 테스트 통과 뒤 4-replica race harness에서도 두 승자 시나리오를
  반복한다.
- 전체 API coverage 100%와 Stability 반복을 통과한다.

## 9. 완료 조건

- movie·theater 모두 생성 승리와 삭제 승리의 결정적 테스트가 있다.
- 어떤 성공 조합에서도 활성 showtime이 비활성 부모를 참조하지 않는다.
- transaction 안의 모든 MongoDB 호출이 같은 session을 사용한다.
- transaction callback 안에서 S3·NATS·Restate 같은 외부 효과를 실행하지 않는다.
- movie asset cleanup은 commit 이후 실패나 process 종료에도 재개할 수 있다.
- 기존 DELETE 204/409와 showtime-creation terminal status 계약의 변경 여부가 문서와
  실행 가능한 테스트에 반영된다.
- 구현 뒤 [`docs/apps.md`](../docs/apps.md)와
  [`docs/reference/decisions.md`](../docs/reference/decisions.md)의 보장 범위를 갱신한다.

## 10. 이번 문서의 비범위

- 기존 showtime을 cascade 삭제하는 정책 변경
- 과거 상영을 언제 정리해야 영화·극장을 다시 삭제할 수 있는지에 대한 retention 정책
- 모든 Core 사이 참조를 위한 범용 foreign-key framework
- 서로 다른 database/process로 서비스를 분리한 뒤의 분산 transaction 프로토콜

현재 정책은 과거·미래를 가리지 않고 showtime 하나라도 참조하면 삭제를 거부한다. 이
정책이 장기적으로 적절한지는 별도 제품 결정이며, 여기서는 현재 정책을 동시 실행에서도
정확하게 보장하는 데만 집중한다.
