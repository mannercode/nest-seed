# Use Cases

영화 예매 시스템의 유스케이스다. 이것은 개념 검증을 위한 프로젝트이기 때문에 실제 영화 예매 시스템과 다소 다른 부분이 있다.

1. 극장에는 여러 개의 상영관이 있으나 편의상 생략한다.
1. 좌석에는 등급 개념이 있으나 편의상 생략한다.

## glossary

- 상영중 showing
- 예매 booking
- 구매 purchase
- 환불 refund
- 상영관 room

## 영화 예매 시스템 유스케이스

```plantuml
@startuml
left to right direction

actor Customer
actor Administrator
component PaymentGateway

package "Movie Ticketing System"{
    usecase "상영 중인 영화 검색" as BrowseShowingMovies
    usecase "티켓 구매" as PurchaseTickets #yellow
    usecase "티켓 환불" as RefundTickets

    usecase "극장 관리" as ManageTheaters
    usecase "영화 관리" as ManageMovies
    usecase "티켓 관리" as ManageTickets
}
Customer --> BrowseShowingMovies
Customer --> PurchaseTickets
Customer --> RefundTickets
Administrator --> ManageTheaters
Administrator --> ManageMovies
Administrator --> ManageTickets
ManageTickets ..> RefundTickets : include
PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
@enduml
```

```plantuml
@startuml
left to right direction

actor Administrator

package "Manage Tickets"{
    usecase "티켓 생성" as GenerateTickets #yellow
    usecase "티켓 환불" as RefundTickets
}

Administrator --> GenerateTickets
Administrator --> RefundTickets
@enduml
```
