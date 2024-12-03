# 티켓 구매 프로세스

### 유스케이스 명: 티켓 구매 (Tickets Purchase)

**선행 조건**:

-   고객이 시스템에 로그인되어 있어야 한다.
-   원하는 영화와 극장의 상영 시간 및 좌석이 사용 가능해야 한다.

**기본 흐름**:

1. 고객은 극장 예매 시스템에 접속한다.
1. 시스템은 주간 인기, 월간 인기, 최신 순서로 정렬된 영화 목록을 제공한다.
1. 고객은 영화 목록에서 원하는 영화를 선택한다.
1. 시스템은 영화를 상영하는 극장 목록을 제공한다.
    - 사용자의 현재 위치를 기반으로 반경 5km의 가까운 극장을 추천
    - 특정 지역을 선택하여 해당 지역의 극장 목록을 제공
    - 없으면 가장 가까운 극장 5개
1. 고객은 상영하는 극장을 선택한다.
1. 시스템은 선택된 극장에서 영화 상영일 목록을 제공한다.
1. 고객은 원하는 상영일을 선택한다.
1. 시스템은 선택한 상영일의 상세 정보를 제공한다.
    - 상영 시간 별 남은 좌석수를 포함해야 한다.
1. 고객은 원하는 상영 시간을 선택한다.
1. 시스템은 해당 상영의 선택이 가능한 좌석을 보여준다.
    - 좌석은 로얄석, 커플석 등 등급이 있다.
    - 좌석은 층,블록,열,좌석번호로 지정된다.
1. 고객은 하나 이상의 좌석을 선택한다.
    - 선택한 좌석은 10분간 선점된다.
1. 시스템은 선택한 좌석과 총 가격을 요약하여 보여준다.
1. 고객은 결제 정보를 입력하고 구매를 확정한다.
1. 시스템은 결제를 처리하고, 티켓 구매 성공 메시지와 함께 전자 티켓을 제공한다.

**대안 흐름**:

-   A1. 원하는 상영 시간이나 좌석이 사용 불가능한 경우:
    -   시스템은 사용 불가능한 메시지를 표시하고, 다른 상영 시간이나 좌석을 선택하도록 유도한다.
-   A2. 결제가 실패한 경우:
    -   시스템은 결제 실패 메시지를 표시하고, 결제 정보를 재입력하거나 다른 결제 방법을 선택하도록 유도한다.

**후행 조건**:

-   고객은 구매한 티켓에 대한 전자 티켓을 이메일로 받는다.
-   시스템은 구매된 티켓의 좌석을 사용 불가능으로 업데이트한다.

**특별 요구 사항**:

-   시스템은 결제 처리를 위해 외부 결제 게이트웨이(PaymentGateway)와 통신해야 한다.
-   시스템은 고객이 선택한 좌석이 동시에 다른 고객에게 판매되지 않도록 동시성 관리를 해야 한다.
-   모든 통신은 보안 프로토콜을 통해 이루어져야 한다.

**비즈니스 규칙**:

-   고객은 한 번에 최대 10장의 티켓을 구매할 수 있다.
-   상영 30분 전까지만 온라인으로 티켓을 구매할 수 있다.

```plantuml
@startuml
actor Customer

Customer -> Frontend : 영화 예매 시스템에 접속
    Frontend -> Backend : 추천 영화 목록 요청\nGET /showing/movies/recommended?customerid={}
        Backend -> Showing: getRecommendedMovies({customerId})
            Showing -> Customers : doesCustomerExist(customerId)
            Showing <-- Customers : true
            group if customer does not exist
            Backend <-- Showing : 404 Not Found
            end
            Showing -> Showtimes : getShowingMovieIds()
            Showing <-- Showtimes : showingMovieIds
            Showing -> Movies : getMovies({movieIds: showingMovieIds})
            Showing <-- Movies : movies
            Showing -> Customers : getWatchHistory(customerId)
            Showing <-- Customers : watchHistory
            Showing -> Showing : generateRecommendedMovies(movies, watchHistory)
                note left
                아래 순서로 간단하게 구현한다.
                1. genre 일치
                2. 최신 개봉일

                showingMovies는 ShowingService에서 관리한다.
                ShowingMovie{
                    ...
                    theaterIds:[]
                }
                end note
        Backend <-- Showing : recommendedMovies[]
    Frontend <-- Backend : recommendedMovies[]
Customer <-- Frontend : 영화 목록 제공
@enduml
```

```plantuml
@startuml
actor Customer

Customer -> Frontend : 영화 선택
    Frontend -> Backend : 상영 극장 목록 요청\nGET /showing/movies/{}/theaters?userLocation=37.123,128.678
        Backend -> Showing: findShowingTheaters({movieId, userLocation})
            Showing -> Showtimes: findShowingTheaterIds({movieId})
            Showing <-- Showtimes: theaterIds[]
            Showing -> Theaters: getTheaters({theaterIds})
            Showing <-- Theaters: theaters[]
            Showing -> Showing: sortTheatersByDistance({theaters, userLocation})
        Backend <-- Showing: showingTheaters[]
    Frontend <-- Backend : showingTheaters[]
Customer <-- Frontend : 상영 극장 목록 제공
@enduml
```

```plantuml
@startuml
actor Customer

Customer -> Frontend : 상영 극장 선택
    Frontend -> Backend : 상영일 목록 요청\nGET /showing/movies/{}/theaters/{}/showdates
        Backend -> Showing: findShowdates({movieId, theaterId})
            Showing -> Showtimes: findShowdates({movieId, theaterId})
                note left
                findShowdates를 단순 호출하고 있는 안티패턴이다.
                그러나 ShowingService의 일관성을 우선한다.
                end note
            Showing <-- Showtimes: showdates[]
        Backend <-- Showing: showdates[]
    Frontend <-- Backend : showdates[]
Customer <-- Frontend : 상영일 목록 제공
@enduml
```

```plantuml
@startuml
actor Customer

Customer -> Frontend : 상영일 선택
    Frontend -> Backend : 상영 시간 목록 요청\nGET /showing/movies/{}/theaters/{}/showdates/{}/showtimes
        Backend -> Showing: getShowtimesWithSalesStatus({movieId, theaterId, showdate})
            Showing -> Showtimes: findShowtimes({movieId, theaterId, showdate})
            Showing <-- Showtimes: showtimes[]
            Showing -> Tickets: getSalesStatuses({ showtimeIds })
            Showing <-- Tickets: salesStatuses[]
            note left
            ShowtimeSalesStatus = {
                showtimeId: string
                salesStatus:{
                    total: number
                    sold: number
                    available: number
                }
            }
            end note
            Showing -> Showing: generateShowtimesWithSalesStatus(Showtimes[], salesStatuses)
        Backend <-- Showing: showtimesWithSalesStatus[]
    Frontend <-- Backend : showtimesWithSalesStatus[]
Customer <-- Frontend : 상영일의 상세 정보 제공
@enduml
```

```plantuml
@startuml
actor Customer

Customer -> Frontend : 상영 시간 선택
    Frontend -> Backend : 상영 시간의 티켓 정보 요청\nGET /showing/showtimes/{}
        Backend -> Showing : getShowingSeatmap(showtimeId)
            Showing -> Tickets : getTickets(showtimeId)
            Showing <-- Tickets : tickets[]
            Showing -> Showing : tickets[]
        Backend <-- Showing: tickets[]
    Frontend <-- Backend : tickets[]
Customer <-- Frontend : 선택 가능한 좌석 정보 제공
@enduml
```

```plantuml
@startuml
actor Customer

Customer->>Frontend: 좌석 선택
    Frontend->>Backend: 티켓 구매\nPOST /payments
        Backend->>Payment: createPayment(ticketIds[])
            Payment->>Tickets: notifyTicketsPurchased(ticketIds[])
                Tickets->>Tickets: updateTicketStatus(ticketIds[], 'sold')
            Tickets-->>Payment: 티켓 구매 처리 완료
        Payment-->>Backend: 결제 완료 및 티켓 정보
    Backend-->>Frontend: 티켓 구매 결과(성공)
Frontend-->>Customer: 구매 완료
@enduml
```
