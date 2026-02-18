# Domain Glossary (`src/apps` 기준)

이 문서는 `src/apps` 소스코드 기준의 도메인 용어 사전이다.
문서/디자인 자료와 충돌 시, 이 문서와 코드 기준을 우선한다.

## 1. 용어 원칙

- 동작(행위)과 결과물(기록)을 구분한다.
    - 예: `processPurchase`(행위) -> `PurchaseRecord`(결과물)
- 범용 인프라 용어와 도메인 용어를 분리한다.
    - 예: 인프라 `AssetsService.finalizeUpload`, 도메인 `MoviesService.attachUploadedAsset`
- 존재 여부 API는 `existsAll`로 통일한다.
    - 의미: 입력된 모든 ID가 존재하면 `true`
- `...RecordId`는 기록성 엔티티의 ID를 명시할 때 사용한다.

## 2. 핵심 용어

| 용어                   | 의미                                      | 대표 코드 식별자                              |
| ---------------------- | ----------------------------------------- | --------------------------------------------- |
| Customer               | 사용자(고객) 엔티티                       | `CustomersService`, `CustomerDto`             |
| Theater                | 상영관(극장) 엔티티                       | `TheatersService`, `TheaterDto`               |
| Showtime               | 상영 일정(시작/종료 시각 포함)            | `ShowtimesService`, `ShowtimeDto`             |
| Showdate               | 상영 날짜(일 단위 조회 축)                | `searchShowdates`, `showdate`                 |
| Ticket                 | 좌석 단위 판매 티켓                       | `TicketDto`, `TicketStatus`                   |
| Ticket Holding         | 티켓 임시 선점 상태                       | `TicketHoldingService`, `holdTickets`         |
| Movie                  | 영화 엔티티                               | `MoviesService`, `MovieDto`                   |
| Asset                  | 파일 메타데이터/소유자 정보               | `AssetsService`, `AssetDto`                   |
| Upload Finalization    | 업로드 완료 확정(인프라)                  | `finalizeUpload`, `FinalizeAssetDto`          |
| Asset Attachment       | 업로드 완료 자산을 영화에 연결            | `attachUploadedAsset`                         |
| Payment                | 외부 결제 완료 기록(튜토리얼 단순화 모델) | `PaymentsService`, `PaymentDto`               |
| Purchase               | 구매 수행 프로세스(행위)                  | `PurchaseService.processPurchase`             |
| Purchase Item          | 구매 입력 아이템(다품목 확장 가능)        | `PurchaseItemDto`, `itemId`                   |
| Purchase Record        | 구매 결과 기록(영수증 성격)               | `PurchaseRecordDto`, `PurchaseRecordsService` |
| Watch Record           | 시청 이력 기록                            | `WatchRecordDto`, `purchaseRecordId`          |
| Recommendation         | 추천 결과 계산                            | `RecommendationService`, `MovieRecommender`   |
| Showtime Creation Saga | 상영 생성 비동기 워크플로우               | `ShowtimeCreationWorkerService`, `sagaId`     |

## 3. 네이밍 규칙

### 3.1 구매(Purchase) 축

- `Purchase`는 프로세스 이름이다.
    - API: `Messages.Purchase.processPurchase`
- 결과 데이터는 `PurchaseRecord`로 표현한다.
    - API: `Messages.PurchaseRecords.create/getMany`
- `PurchaseItem`의 식별자는 `itemId`를 사용한다.
    - 티켓 전용 필드명(`ticketId`)을 구매 공용 모델에 두지 않는다.
- 아이템군(enum)은 복수형 값을 사용한다.
    - 예: `PurchaseItemType.Tickets`, `PurchaseItemType.Foods`

### 3.2 자산(Asset) 축

- 인프라 계층:
    - `finalizeUpload`: 업로드 완료를 확정하고 owner를 할당
- 영화 도메인 계층:
    - `attachUploadedAsset`: 업로드 완료 자산을 movie에 연결
- HTTP 라우트:
    - `/movies/:movieId/assets/:assetId/finalize`

### 3.3 존재 여부

- `existsAll(ids)`만 허용한다.
- 금지: `allExist`, 모호한 `exists(ids)`

### 3.4 기록 ID 명명

- 기록성 엔티티 ID는 `...RecordId`를 사용한다.
    - 예: `purchaseRecordId`
- 복수는 `...RecordIds`를 사용한다.

### 3.5 이벤트 키 케이스

- 이벤트 키는 camelCase로 통일한다.
    - 예: `Events.Purchase.ticketPurchased`, `Events.Purchase.ticketPurchaseCanceled`

### 3.6 에러 코드 접두어

- Ticket purchase 도메인 에러 코드는 `ERR_TICKET_PURCHASE_*`로 통일한다.

## 4. 비권장/제거 용어

| 비권장 용어                              | 대체 용어                                |
| ---------------------------------------- | ---------------------------------------- |
| `allExist`                               | `existsAll`                              |
| `CompleteAssetDto`                       | `FinalizeAssetDto`                       |
| `completeDto` (asset finalize payload)   | `finalizeDto`                            |
| `/assets/:assetId/complete`              | `/assets/:assetId/finalize`              |
| `InvalidForCompletion` (movie publish)   | `InvalidForPublish`                      |
| `purchaseId` (watch record 맥락)         | `purchaseRecordId`                       |
| `ticketId` (purchase item 공용 모델)     | `itemId`                                 |
| `MovieDrafts` (현재 미구현 메시지)       | 제거                                     |
| `Events.Purchase.TicketPurchased`        | `Events.Purchase.ticketPurchased`        |
| `Events.Purchase.TicketPurchaseCanceled` | `Events.Purchase.ticketPurchaseCanceled` |
| `ERR_PURCHASE_MAX_TICKETS_EXCEEDED`      | `ERR_TICKET_PURCHASE_LIMIT_EXCEEDED`     |
| `ERR_PURCHASE_WINDOW_CLOSED`             | `ERR_TICKET_PURCHASE_WINDOW_CLOSED`      |
| `ERR_PURCHASE_TICKET_NOT_HELD`           | `ERR_TICKET_PURCHASE_NOT_HELD`           |

## 5. 구현 시 체크리스트

- 새 용어를 추가할 때 다음을 동시에 확인한다.
    - DTO/Model/Service/Controller/Client/Message 키가 같은 용어를 쓰는가
    - 행위 명칭과 결과물 명칭이 섞이지 않았는가
    - 인프라 용어와 도메인 용어를 구분했는가
    - 단수/복수(`Id`/`Ids`, `Record`/`Records`)가 일치하는가
