# Use Cases

영화 예매 시스템의 유스케이스다. 이것은 개념 검증을 위한 프로젝트이기 때문에 실제 영화 예매 시스템과 다소 다른 부분이 있다.

1. 극장에는 여러 개의 상영관이 있으나 편의상 생략한다.
1. 좌석에는 등급 개념이 있으나 편의상 생략한다.

## glossary

-   상영중 showing
-   상영시간 showtime
-   상영일 showdate
-   예매 booking
-   구매 purchase
-   환불 refund
-   상영관 room

## 영화 예매 시스템 유스케이스

```plantuml
@startuml
left to right direction

actor Customer
actor Administrator
component PaymentGateway

package "Movie Ticketing System"{
    package showtimes {
        usecase "상영시간 등록" as CreateShowtimes
        usecase "상영시간 검색" as FindShowtimes
    }

    package tickets {
        usecase "티켓 구매" as PurchaseTickets #yellow
        usecase "티켓 생성" as GenerateTickets #yellow
        usecase "티켓 환불" as RefundTickets
    }
}

Customer --> PurchaseTickets #line:red
Customer --> RefundTickets #line:red
Customer --> FindShowtimes #line:red

Administrator --> tickets #line:blue
Administrator --> showtimes #line:blue

PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
```

```plantuml
@startuml
left to right direction

actor Customer
actor Administrator

package "Movie Ticketing System"{

    package theaters {
        usecase "극장 등록" as AddTheaters
        usecase "극장 검색" as FindTheaters
    }

    package movies {
        usecase "영화 등록" as AddMovies
        usecase "영화 검색" as FindMovies
    }

    package customers {
        usecase "고객 등록" as RegisterCustomer
        usecase "고객 로그인" as LoginCustomer
        usecase "고객 검색" as FindCustomers
    }
}

Customer --> RegisterCustomer #line:red
Customer --> LoginCustomer #line:red
Customer --> FindTheaters #line:red
Customer --> FindMovies #line:red

Administrator --> theaters #line:blue
Administrator --> movies #line:blue
Administrator --> FindCustomers #line:blue

@enduml
```
