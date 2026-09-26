# API 전체 감사 — 2026-09-26

## 범위와 수행

- 기준 HEAD: `6bbe8cdf7df05ce9aa69cd6ab116f8ccde3fb7f0`.
- 지정 목록 `api-files.json`의 **272개 파일 전체**: 텍스트 271개·8,891줄, PNG 1개. 이전 검토 결과나 변경 diff를 감사의 대체로 사용하지 않고 이번 HEAD 내용을 새로 읽었다.
- README·AGENTS·docs/apps.md·docs/reference/decisions.md·conventions.md를 먼저 읽었다. 실행 코드뿐 아니라 barrel 61개, DTO 경로 71개, 모델·fixture·스크립트도 포함했다. 파일별 읽음·검증·판정은 [전체 파일 목록](files.md)에 있다.
- PNG를 화면으로 확인했고 전체 바이트를 읽어 384×256, 170,550 bytes, SHA-256 Base64 `d5l1XdGa5zgerERd5V5xMR0X0mbMoZvJL1liTH1to2A=`가 `.env`와 일치함을 확인했다. 업로드 fixture의 그림 내용은 기능 계약에 영향을 주지 않는다.
- bash `-n`과 Node `--check`로 해당하는 실행 파일 16개의 문법을 검사했다.
- 실제 현재 API TypeScript를 TypeScript compiler로 메모리에서 변환하고 기존 common 배포물을 연결해 API 서비스·repository를 직접 호출했다. 별도 `review_0a825e434ed9491990d20d20fba12e67` DB에서 Mongo transaction·생성·판매·조회·queryPlanner를 확인했다. finally에서 해당 임시 DB를 삭제했다. 기존 앱·테스트 DB, Redis, S3, NATS, Restate에는 쓰지 않았다.
- 재현 artifact: `api-inline.cjs`, 결과 `api-inline.log`. 소스·설정·저장소 테스트 파일은 수정하지 않았다.
- 전체 API 390/common 548/testing 29, 100% coverage 및 lint 통과 결과는 [통합 결과](README.md)에 있다. 아래 재현은 그 테스트에 없는 입력 연결을 확인한 것이며 전체 HTTP·Redis 선점·Restate journal 경로까지 새로 실행했다는 뜻은 아니다.

## 실제 결함

### API-1 — P1 / 확신 높음: 같은 좌석 좌표의 티켓을 중복 생성·판매할 수 있다

**발생 조건**: POST/PATCH 극장 입력에 같은 block 안의 같은 row 이름을 반복한다. 같은 block 이름과 같은 row를 가진 block을 반복해도 같은 현상이 생긴다.

```json
{
    "blocks": [
        {
            "name": "A",
            "rows": [
                { "name": "1", "layout": "O" },
                { "name": "1", "layout": "O" }
            ]
        }
    ]
}
```

**근거**:

- [apps/api/src/services/core/theaters/models/seatmap.ts](../../apps/api/src/services/core/theaters/models/seatmap.ts) 12행의 block 및 `:23`의 seatmap 스키마는 이름 중복을 검사하지 않는다.
- 같은 파일 `:48`의 iterator는 block 이름·row 이름·문자 위치를 좌표로 사용하므로 위 입력은 `{block:'A', row:'1', seatNumber:1}`을 두 번 만든다.
- [apps/api/src/services/core/theaters/dtos/create-theater.dto.ts](../../apps/api/src/services/core/theaters/dtos/create-theater.dto.ts) 7행과 `update-theater.dto.ts:4`가 그 스키마를 HTTP 생성·수정에 사용한다.
- [apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts](../../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts) 114행는 생성된 좌표마다 티켓을 만든다.
- [apps/api/src/services/core/tickets/tickets.repository.ts](../../apps/api/src/services/core/tickets/tickets.repository.ts) 63행은 각 티켓에 다른 ID를 발급한다. `:27`의 인덱스에는 좌표 유일성 제약이 없고 `:95`의 판매 조건은 티켓 ID를 기준으로 한다.

**실제 재현**: CreateTheaterSchema 검사가 성공했다. 실제 persistence transaction은 `succeeded`, 상영 1개·티켓 2개를 반환했다. 두 ID를 서로 다른 purchaseRecordId로 `TicketsService.sellForPurchase`에 전달하자 같은 A/1/1 좌석의 두 DB 티켓이 모두 `sold`가 됐다. 이는 같은 티켓 ID의 이중 판매 CAS를 깨는 문제가 아니라 그 전에 같은 물리 좌석을 서로 다른 티켓으로 만드는 문제다.

**영향**: 시드가 설명하는 좌석 판매 정합성을 정상적인 관리자 입력 하나로 훼손한다. 별도의 장애·race나 보안 정책을 가정하지 않는다.

**최소 수정**: 생성·수정이 공유하는 SeatmapSchema에서 같은 `(block,row,seatNumber)` 좌표가 두 번 생성되는 입력을 거부한다. 블록/행 이름 유일성으로 표현할지 생성 좌표 기준으로 검사할지는 입력 모델을 따라 결정한다. 새 좌석 ID·범용 검증 프레임워크는 필요 없다. DB unique 제약 추가는 이번 최소 수정의 필수 조건으로 단정하지 않았다.

### API-2 — P2 / 확신 높음: 허용된 0좌석 상영을 예매 화면에서 조회하면 500이다

**발생 조건**: `seatmap.blocks=[]` 또는 모든 자리가 `X`인 극장으로 상영을 만들고 그 날짜의 예매 상영 목록을 조회한다.

**근거**:

- [apps/api/src/services/core/theaters/models/seatmap.ts](../../apps/api/src/services/core/theaters/models/seatmap.ts) 23행은 빈 배열을 허용한다. 이는 잘못된 입력이라고 추측한 것이 아니다. 기존 `theaters.spec.ts:73`은 빈 seatmap으로 PATCH 성공을 기대하고 순수 Seatmap 테스트도 빈 배치·전부 X의 좌석 수 0을 기대한다.
- [apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts](../../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts) 114행에서 티켓 배열이 비고 common `CrudRepository.insertMany`는 빈 배열을 정상 no-op으로 처리한다. 상영과 operation은 성공으로 저장된다.
- [apps/api/src/services/core/tickets/tickets.repository.ts](../../apps/api/src/services/core/tickets/tickets.repository.ts) 34행의 집계는 실제 티켓이 있는 showtime에만 행을 만든다.
- [apps/api/src/services/application/booking/booking.service.ts](../../apps/api/src/services/application/booking/booking.service.ts) 97행의 집계 결과를 넘겨받은 `booking.utils.ts:15`는 모든 상영에 집계 행이 있다고 강제한다.

**실제 재현**: 실제 persistence 결과는 `succeeded`, 상영 1개·티켓 0개였다. 이어서 실제 `BookingService.searchShowtimes`를 호출하자 500 `Internal server error`, cause `ticketSales missing for showtime ...`가 발생했다.

**영향**: 현재 허용된 CRUD 입력과 성공한 상영 생성 결과를 기존 조회 기능이 소비하지 못한다.

**최소 수정**: 0좌석 허용을 유지하면서 요청한 상영의 판매 집계가 0/0/0임을 반환하도록 집계·조합 경계를 맞춘다. 정상적인 빈 집합의 count를 표현하는 문제이며 예외를 삼킬 일이 아니다. 빈 좌석 자체를 금지하는 변경은 기존 HTTP 계약을 바꾸므로 별도 선택 없이 적용하면 안 된다.

### API-3 — P2 / 확신 높음: 결제의 부분 unique index를 멱등성 조회가 사용하지 못한다

**발생 조건**: 결제 기록이 누적된 상태에서 결제를 생성·재시도하거나 purchaseRecordId로 보상 대상을 찾는다.

**근거**:

- [apps/api/src/services/infrastructure/payments/payments.repository.ts](../../apps/api/src/services/infrastructure/payments/payments.repository.ts) 26행은 `purchaseRecordId`에 `$type:'string'` 조건이 있는 부분 unique index를 만든다.
- 같은 파일 `:52`의 upsert 필터, `:75`의 생성 후 조회, `:82`의 보상 조회는 문자열 equality만 전달한다.
- 실제 MongoDB에서 equality만으로는 이 부분 필터를 만족하는 전체 쿼리라고 판정하지 않았다. PurchaseRecords의 `findByIdempotencyKey`에는 같은 이유로 `$type`을 명시하고 있지만 Payments에는 빠져 있다.

**실제 재현**: 실제 PaymentsRepository가 생성한 인덱스와 review DB의 활성 결제 1,000건으로 explain을 실행했다.

| 조회                           | 선택 인덱스                     | examined docs | examined keys | 반환 |
| ------------------------------ | ------------------------------- | ------------: | ------------: | ---: |
| 현재 equality + deletedAt:null | deletedAt_1                     |          1000 |          1000 |    1 |
| equality에 $type:string 명시   | purchaseRecordId_partial_unique |             1 |             1 |    1 |

COLLSCAN이라고 부정확하게 쓰지 않는다. 실제 선택은 `deletedAt_1` IXSCAN 뒤 활성 문서 전부 FETCH였다. 인덱스 유일성에 따른 중복 방지 자체는 유지된다.

**영향**: 결제 생성·재시도·보상당 비용이 누적 활성 결제 수에 비례한다. 시드의 현재 멱등성 경로에 이미 존재하는 인덱스가 제 역할을 못 하는 문제다.

**최소 수정**: 위 세 purchaseRecordId 조건에 equality와 함께 기존 부분 인덱스의 `$type:'string'` 조건을 명시한다. 새 인덱스나 공통 추상화가 필요하지 않다.

### API-4 — P2 / 확신 높음: 스키마가 허용한 상영 시간이 실행 중 RangeError로 끝날 수 있다

**발생 조건**: `durationInMinutes=1/7`처럼 millisecond 단위 정수로 표현되지 않는 양수 분 값을 제출한다.

**근거**:

- [apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts](../../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts) 5행는 `z.number().positive()`만 검사한다.
- [apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts](../../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts) 86행과 `showtime-bulk-creator.service.ts:66`은 그 값을 DateUtil.add에 전달한다.
- common [libs/common/src/utils/date.ts](../../libs/common/src/utils/date.ts) 29행는 분을 milliseconds로 환산하여 `Temporal.Instant.fromEpochMilliseconds`에 전달한다. 이 API는 정수 milliseconds를 요구한다.
- [apps/api/src/services/application/showtime-creation/worker/workflow.ts](../../apps/api/src/services/application/showtime-creation/worker/workflow.ts) 77행의 실행 step은 이 RangeError를 업무 입력 거절로 분류하지 않는다. 재시도 정책 후 `:94`에서 시스템 `error` 상태로 끝난다.

**실제 재현**: 실제 BulkCreateShowtimesSchema.parse는 0.14285714285714285를 허용했고, 실제 DateUtil.add는 `RangeError: Temporal error: Expected finite integer.`를 던졌다. Restate 재시도 횟수까지 실제 실행하지는 않았고 그 이후 상태는 읽은 workflow 제어 흐름에 따른 결론이다.

**영향**: 계산 불가능한 입력을 접수해 DB 접수 기록·workflow를 만든 뒤 불필요한 시스템 오류 재시도를 수행한다. 0.5분 같은 표현 가능한 소수까지 모두 잘못됐다고 주장하지 않는다.

**최소 수정**: 현재 millisecond 기반 계산이 처리할 수 있는 시간 값을 접수 전 스키마에서 확인해 입력 오류로 반환한다. 분을 무조건 정수로 제한할지는 별도 API 계약 결정이며 자동으로 선택하지 않는다. DateUtil의 정밀도를 임의 반올림해 통과시키는 수정은 피한다.

## 배치·네이밍·중복·과설계 평가

### 유지가 타당한 분리

Gateway의 controller를 AppModule에 두고 Core의 CRUD 및 Application의 다중 도메인 조합을 소비하는 실제 구조가 설명과 일치한다. 예를 들어 MoviesHttpController가 MoviesService와 CatalogManagementService를 함께 사용하는 구조를 도메인 모듈로 되돌릴 이유가 없다. View도 조회·응답 조합에 한정되어 있다.

구매의 workflow, transaction, 티켓 claim, 알림 consumer와 상영의 제출 lease, 검증·생성 transaction, workflow는 각각 다른 실패·재실행 경계를 소유한다. 파일 수만 보고 이들을 한 서비스로 합치면 현재 책임을 읽기 어려워진다. 409+lease, 100% coverage, 복제본 4개, 반복 CI, common의 SDK 실행 경계는 오류나 이번 감사의 제거 대상으로 다루지 않았다.

user/admin authentication wrapper의 모양은 비슷하지만 토큰 이름·역할별 설정·도메인 조회 책임을 연결한다. 두 구현을 줄이겠다고 새 인증/BFF 프레임워크를 만드는 것은 이 시드 목적에 맞지 않는다. 영화 DTO의 에셋 URL 일괄 조회와 공개/내부 영화 조회 분리도 필요한 경계다.

### 읽기 비용을 줄일 수 있는 작은 선택 — P3, 기능 결함 아님

1. **Booking의 세 내부 검색 DTO 클래스**: `booking-search-showdates.dto.ts:1`, `booking-search-showtimes.dto.ts:1`, `booking-search-theaters.dto.ts:3`은 각각 2~3개의 필드만 가진 class이고 실제 소비자는 BookingService 한 파일뿐이다. HTTP에서는 개별 route/query pipe가 이미 값을 만들고 class를 instantiate하거나 decorator metadata로 사용하지 않는다. 서비스의 인자를 이해하려고 세 파일과 barrel을 추가로 열게 된다. 객체 type을 기본으로 한다는 conventions와도 거리가 있다. 이 세 가지를 가까운 내부 타입 파일 또는 서비스 옆 타입 선언으로 모으는 정도는 선택 가능하다. 전체 DTO의 일괄 이동·class 금지는 필요 없다.
2. **한 필드 결과 클래스 두 개**: `showtimes/dtos/create-showtimes.result.ts:1`, `tickets/dtos/create-tickets.result.ts:1`은 `count:number`뿐이고 각각 자기 서비스 반환형에서만 사용한다. 실행 코드도 직접 `{count: createDtos.length}`를 반환한다. 이름 있는 독립 계약이 필요한 이유가 현재 코드에 없으므로 해당 메서드의 작은 반환 타입으로 표현하면 탐색 비용을 줄일 수 있다. 두 도메인을 연결하는 범용 Result 계층을 만들 이유는 없다.
3. **오래된 설명 한 줄**: `theaters/models/theater.ts:12`의 “내부 버전이다” 주석은 바로 아래에 대상 필드가 없어서 무엇을 설명하는지 불분명하다. 실제 guard는 TheatersRepository가 상속된 `__v`를 갱신한다. 필요한 설명은 그 갱신부에 이미 있으므로 이 고립된 주석을 정리할 수 있다.

61개 barrel·71개 DTO 경로라는 개수 자체가 과설계의 증거는 아니다. 공개 진입점·런타임 스키마·도메인 모델을 분리한 가치가 있고, 위처럼 한 곳에서만 쓰며 별도 역할이 없는 작은 타입부터 판단하는 편이 맞다.

## 시드 목적 적합성과 정책 미결의 구분

API 본체·재사용 common·작은 Next.js 데모라는 범위를 유지하며 단순 CRUD→도메인 협력→분산 실행을 읽는 순서가 실제 코드에서도 성립한다. 이번 확인된 4개 결함은 새 제품 기능 없이 기존 입력·생성·조회·멱등성 경계 안에서 다룰 수 있다.

다만 관람 기록은 현재 runtime에서 RecommendationService가 읽지만, `WatchRecordsService.create`의 호출자는 테스트·fixture뿐이다. 따라서 추천 알고리즘과 조합 예제는 있으나 데모 사용만으로 새 관람 이력이 쌓여 개인화되는 전체 동선은 없다. 이것을 요구된 기능 누락으로 판정하지 않았다. 실제 관람 판정·구매와 연결·관람 입력 API를 추가하려면 별도 제품 계약이 필요하다.

결제 provider 멱등성 키, 알림 소비자의 durable inbox, 즉시 액세스 회수, 영화·극장 삭제와 생성의 동시성, 운영 revision 배포 체계 등 문서가 제외하거나 호출자에게 맡긴 책임은 새 결함으로 확대하지 않았다. 유효한 0좌석 극장도 새 금지 정책을 먼저 넣지 않고 현재 계약의 연결 오류만 분리했다.

## 검증 한계

모든 대상 파일의 내용과 실행 경계를 읽었지만 모든 입력 조합·외부 장애·네트워크 경쟁을 재현한 것은 아니다. 분리 DB의 실제 생성·판매 검증은 Redis 선점·HTTP 인증·실제 결제 workflow를 모두 통과한 end-to-end 실행이 아니다. 중복 좌표가 다른 티켓 ID로 생성되고 현 판매 원자성이 그 둘을 별개로 허용한다는 직접 근거다. 전체 HTTP 결과·Restate 반복 실행이 필요한 후속 수정 검증은 기존 통합 테스트에서 수행해야 한다.
