# Tickets Purchase

## 1. 유스케이스 명세서

**목표**: 고객이 원하는 영화의 좌석을 선택하고 티켓을 구매하기

**액터**: 고객

**선행 조건**:

- 고객은 시스템에 로그인되어 있어야 한다.
- 구매할 영화의 상영시간과 좌석이 사용 가능해야 한다.

**기본 흐름**:

1. 시스템은 현재 상영 중인 영화 목록을 추천순으로 제공한다.
1. 고객은 원하는 영화를 선택한다.
1. 시스템은 해당 영화를 상영 중인 극장 목록을 거리순으로 제공한다.
1. 고객은 극장을 선택한다.
1. 시스템은 선택한 극장의 상영일 목록을 제공한다.
1. 고객은 원하는 상영일을 선택한다.
1. 시스템은 해당 상영일의 상영시간 목록과 잔여 좌석 수를 제공한다.
1. 고객은 원하는 상영시간을 선택한다.
1. 시스템은 선택 가능한 좌석 목록을 제공한다.
1. 고객은 하나 이상의 좌석을 선택한다. 선택한 좌석은 10분간 선점된다.
1. 고객은 결제 정보를 입력하고 구매를 확정한다.
1. 시스템은 결제를 처리하고 구매 완료 정보를 반환한다.

**대안 흐름**:

- 티켓이 이미 선점된 경우: 시스템은 선점 실패를 반환한다.
- 결제 처리 후 티켓 상태 업데이트에 실패한 경우: 시스템은 티켓 상태를 롤백하고 예외를 던진다.

**비즈니스 규칙**:

- 고객은 한 번에 최대 10장의 티켓을 구매할 수 있다. (`Rules.Ticket.maxTicketsPerPurchase = 10`)
- 상영 시작 30분 전까지만 온라인으로 티켓을 구매할 수 있다. (`Rules.Ticket.purchaseCutoffMinutes = 30`)
- 티켓 선점 유효 시간은 10분이다. (`Rules.Ticket.holdDurationInMs = 10m`)
- 구매 시점에 티켓이 선점 상태여야 한다.

---

## 2. 시퀀스 다이어그램

### 2.1. 영화 추천

```plantuml
@startuml
actor Customer

Customer -> Frontend: 영화 예매 시스템 접속
    Frontend -> Backend: 추천 영화 목록 요청\nGET /movies/recommended
        Backend -> Recommendation: searchRecommendedMovies(customerId?)
            Recommendation -> Showtimes: searchMovieIds({startTimeRange: {start: now + 30m}})
            Recommendation <-- Showtimes: movieIds[]
            Recommendation -> Movies: getMany(movieIds)
            Recommendation <-- Movies: MovieDto[]
            opt customerId 존재
                Recommendation -> WatchRecords: searchPage({customerId, orderby: watchDate DESC, take: 50})
                Recommendation <-- WatchRecords: { items: WatchRecordDto[] }
                Recommendation -> Movies: getMany(watchedMovieIds)
                Recommendation <-- Movies: watchedMovies[]
            end
            Recommendation -> Recommendation: MovieRecommender.recommend\n(showingMovies, watchedMovies)
            note right
                1순위: 장르 일치
                2순위: 최신 개봉일
            end note
        Backend <-- Recommendation: MovieDto[]
    Frontend <-- Backend: movies[]
Customer <-- Frontend: 추천 영화 목록 제공
@enduml
```

### 2.2. 극장 / 날짜 / 상영시간 선택

```plantuml
@startuml
actor Customer

Customer -> Frontend: 영화 선택
    Frontend -> Backend: 상영 극장 목록 요청\nGET /booking/movies/{movieId}/theaters?latLong=...
        Backend -> Booking: searchTheaters({movieId, latLong})
            Booking -> Showtimes: searchTheaterIds({movieIds: [movieId]})
            Booking <-- Showtimes: theaterIds[]
            Booking -> Theaters: getMany(theaterIds)
            Booking <-- Theaters: TheaterDto[]
            Booking -> Booking: sortTheatersByDistance(theaters, latLong)
        Backend <-- Booking: TheaterDto[]
    Frontend <-- Backend: theaters[]
Customer <-- Frontend: 상영 극장 목록 제공

Customer -> Frontend: 극장 선택
    Frontend -> Backend: 상영일 목록 요청\nGET /booking/movies/{movieId}/theaters/{theaterId}/showdates
        Backend -> Booking: searchShowdates({movieId, theaterId})
            Booking -> Showtimes: searchShowdates({movieIds: [movieId], theaterIds: [theaterId]})
            Booking <-- Showtimes: Date[]
        Backend <-- Booking: Date[]
    Frontend <-- Backend: showdates[]
Customer <-- Frontend: 상영일 목록 제공

Customer -> Frontend: 상영일 선택
    Frontend -> Backend: 상영시간 목록 요청\nGET /booking/movies/{movieId}/theaters/{theaterId}/showdates/{showdate}/showtimes
        Backend -> Booking: searchShowtimes({movieId, theaterId, showdate})
            Booking -> Showtimes: search({movieIds, theaterIds, startTimeRange: [하루 범위]})
            Booking <-- Showtimes: ShowtimeDto[]
            Booking -> Tickets: aggregateSales({showtimeIds})
            Booking <-- Tickets: TicketSalesDto[]
            note right
            TicketSalesDto {
                showtimeId: string
                total: number
                sold: number
                available: number
            }
            end note
            Booking -> Booking: generateShowtimesForBooking(showtimes, ticketSales)
        Backend <-- Booking: ShowtimeWithSalesDto[]
    Frontend <-- Backend: showtimesWithSales[]
Customer <-- Frontend: 상영시간 + 잔여 좌석 수 제공
@enduml
```

### 2.3. 좌석 선택 및 선점

```plantuml
@startuml
actor Customer

Customer -> Frontend: 상영시간 선택
    Frontend -> Backend: 티켓 목록 요청\nGET /booking/showtimes/{showtimeId}/tickets
        Backend -> Booking: getTickets(showtimeId)
            Booking -> Showtimes: allExist([showtimeId])
            Booking <-- Showtimes: boolean
            Booking -> Tickets: search({showtimeIds: [showtimeId]})
            Booking <-- Tickets: TicketDto[]
        Backend <-- Booking: TicketDto[]
    Frontend <-- Backend: tickets[]
Customer <-- Frontend: 좌석 목록 제공

Customer -> Frontend: 좌석 선택
    Frontend -> Backend: 티켓 선점\nPATCH /booking/showtimes/{showtimeId}/tickets
    note right
    HoldTicketsDto {
        customerId: string
        showtimeId: string
        ticketIds: string[]
    }
    end note
        Backend -> Booking: holdTickets(dto)
            Booking -> TicketHolding: holdTickets(dto)
            note right
                Redis Lua 스크립트로 원자적 처리
                ttl = Rules.Ticket.holdDurationInMs (10분)
            end note
            Booking <-- TicketHolding: boolean (success)
        Backend <-- Booking: { success: true }
    Frontend <-- Backend: 선점 완료
Customer <-- Frontend: 좌석 선점 완료 안내
@enduml
```

### 2.4. 결제 및 구매 완료

Temporal 워크플로우(`purchaseWorkflow`)가 구매 흐름 전체를 오케스트레이션한다. 각 단계는 Temporal Activity로 실행되며, 실패 시 보상 스택을 역순으로 실행한다.

```plantuml
@startuml
actor Customer

Customer -> Frontend: 결제 정보 입력 및 구매 확정
    Frontend -> Backend: 결제 요청\nPOST /purchases
    note right
    CreatePurchaseDto {
        customerId: string
        totalPrice: number
        purchaseItems: [
            { type: 'tickets', itemId: ticketId }
        ]
    }
    end note
        Backend -> Purchase: processPurchase(dto)
            Purchase -> Temporal: workflow.start(purchaseWorkflow, dto)

            box "Temporal Workflow: purchaseWorkflow" #LightBlue
                Temporal -> TicketPurchase: [Activity] validatePurchase(dto)
                activate TicketPurchase
                    TicketPurchase -> Tickets: getMany(ticketIds)
                    TicketPurchase <-- Tickets: TicketDto[]
                    TicketPurchase -> Showtimes: getMany(showtimeIds)
                    TicketPurchase <-- Showtimes: ShowtimeDto[]
                    TicketPurchase -> TicketPurchase: validateTicketCount(ticketItems)
                    note right: 최대 10장
                    TicketPurchase -> TicketPurchase: validatePurchaseTime(showtimes)
                    note right: 상영 시작 30분 전까지
                    TicketPurchase -> TicketHolding: searchHeldTicketIds(showtimeId, customerId)
                    TicketPurchase <-- TicketHolding: heldTicketIds[]
                    TicketPurchase -> TicketPurchase: 모든 티켓이 선점 상태인지 확인
                Temporal <-- TicketPurchase: void (검증 완료)
                deactivate TicketPurchase

                Temporal -> Payments: [Activity] createPayment(totalPrice, customerId)
                Temporal <-- Payments: PaymentDto
                note right: 보상 스택에 cancelPayment 등록

                Temporal -> PurchaseRecords: [Activity] createPurchaseRecord({...dto, paymentId})
                Temporal <-- PurchaseRecords: PurchaseRecordDto
                note right: 보상 스택에 deletePurchaseRecord 등록

                Temporal -> TicketPurchase: [Activity] completePurchase(dto)
                activate TicketPurchase
                    TicketPurchase -> Tickets: updateStatusMany(ticketIds, TicketStatus.Sold)
                    TicketPurchase <-- Tickets: TicketDto[]
                    TicketPurchase -> Events: emitTicketPurchased(customerId, ticketIds)
                    note left: WatchRecords가 이 이벤트를 구독한다
                Temporal <-- TicketPurchase: void
                deactivate TicketPurchase
            end box

            Purchase <-- Temporal: PurchaseRecordDto
        Backend <-- Purchase: PurchaseRecordDto
    Frontend <-- Backend: 구매 완료 정보
Customer <-- Frontend: 구매 완료 안내
@enduml
```

---

## 3. 롤백 처리 (Temporal 보상 스택)

워크플로우 실행 중 예외가 발생하면 보상 스택을 역순으로 실행한다.

```plantuml
@startuml
[o-> Workflow: 예외 발생

Workflow -> Workflow: 보상 스택 역순 실행
    Workflow -> PurchaseRecords: [Compensation] deletePurchaseRecord(id)
    Workflow <-- PurchaseRecords: void
    Workflow -> Payments: [Compensation] cancelPayment(paymentId)
    Workflow <-- Payments: void

Workflow -> TicketPurchase: [Compensation] rollbackPurchase(dto)
    TicketPurchase -> Tickets: updateStatusMany(ticketIds, TicketStatus.Available)
    TicketPurchase -> Events: emitTicketPurchaseCanceled(customerId, ticketIds)
Workflow <-- TicketPurchase: void
Workflow -> Workflow: throw error
@enduml
```

> 보상 스택은 성공한 Activity만 역순으로 취소한다. 예를 들어 `createPayment`까지만 성공했다면 `cancelPayment`만 실행되고 `deletePurchaseRecord`는 실행되지 않는다.
