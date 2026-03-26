> **English** | [한국어](../../ko/designs/tickets-purchase.md)

# Tickets Purchase

## 1. Use Case Specification

**Goal**: Customer selects seats for a desired movie and purchases tickets

**Actor**: Customer

**Preconditions**:

- The customer must be logged into the system.
- The showtime and seats for the movie to purchase must be available.

**Main Flow**:

1. The system provides a list of currently showing movies sorted by recommendation.
1. The customer selects a desired movie.
1. The system provides a list of theaters showing the movie, sorted by distance.
1. The customer selects a theater.
1. The system provides a list of showdates for the selected theater.
1. The customer selects a desired showdate.
1. The system provides a list of showtimes for the selected date with remaining seat counts.
1. The customer selects a desired showtime.
1. The system provides a list of available seats.
1. The customer selects one or more seats. Selected seats are held for 10 minutes.
1. The customer enters payment information and confirms the purchase.
1. The system processes the payment and returns the completed purchase information.

**Alternative Flows**:

- If a ticket is already held: The system returns a hold failure.
- If ticket status update fails after payment processing: The system rolls back the ticket status and throws an exception.

**Business Rules**:

- A customer can purchase a maximum of 10 tickets at a time. (`Rules.Ticket.maxTicketsPerPurchase = 10`)
- Tickets can only be purchased online up to 30 minutes before showtime. (`Rules.Ticket.purchaseCutoffMinutes = 30`)
- Ticket hold duration is 10 minutes. (`Rules.Ticket.holdDurationInMs = 10m`)
- Tickets must be in held status at the time of purchase.

---

## 2. Sequence Diagrams

### 2.1. Movie Recommendation

```plantuml
@startuml
actor Customer

Customer -> Frontend: Access movie ticketing system
    Frontend -> Backend: Request recommended movies\nGET /movies/recommended
        Backend -> Recommendation: searchRecommendedMovies(customerId?)
            Recommendation -> Showtimes: searchMovieIds({startTimeRange: {start: now + 30m}})
            Recommendation <-- Showtimes: movieIds[]
            Recommendation -> Movies: getMany(movieIds)
            Recommendation <-- Movies: MovieDto[]
            opt customerId exists
                Recommendation -> WatchRecords: searchPage({customerId, orderby: watchDate DESC, take: 50})
                Recommendation <-- WatchRecords: { items: WatchRecordDto[] }
                Recommendation -> Movies: getMany(watchedMovieIds)
                Recommendation <-- Movies: watchedMovies[]
            end
            Recommendation -> Recommendation: MovieRecommender.recommend\n(showingMovies, watchedMovies)
            note right
                Priority 1: Genre match
                Priority 2: Latest release date
            end note
        Backend <-- Recommendation: MovieDto[]
    Frontend <-- Backend: movies[]
Customer <-- Frontend: Provide recommended movie list
@enduml
```

### 2.2. Theater / Date / Showtime Selection

```plantuml
@startuml
actor Customer

Customer -> Frontend: Select movie
    Frontend -> Backend: Request theater list\nGET /booking/movies/{movieId}/theaters?latLong=...
        Backend -> Booking: searchTheaters({movieId, latLong})
            Booking -> Showtimes: searchTheaterIds({movieIds: [movieId]})
            Booking <-- Showtimes: theaterIds[]
            Booking -> Theaters: getMany(theaterIds)
            Booking <-- Theaters: TheaterDto[]
            Booking -> Booking: sortTheatersByDistance(theaters, latLong)
        Backend <-- Booking: TheaterDto[]
    Frontend <-- Backend: theaters[]
Customer <-- Frontend: Provide theater list

Customer -> Frontend: Select theater
    Frontend -> Backend: Request showdate list\nGET /booking/movies/{movieId}/theaters/{theaterId}/showdates
        Backend -> Booking: searchShowdates({movieId, theaterId})
            Booking -> Showtimes: searchShowdates({movieIds: [movieId], theaterIds: [theaterId]})
            Booking <-- Showtimes: Date[]
        Backend <-- Booking: Date[]
    Frontend <-- Backend: showdates[]
Customer <-- Frontend: Provide showdate list

Customer -> Frontend: Select showdate
    Frontend -> Backend: Request showtime list\nGET /booking/movies/{movieId}/theaters/{theaterId}/showdates/{showdate}/showtimes
        Backend -> Booking: searchShowtimes({movieId, theaterId, showdate})
            Booking -> Showtimes: search({movieIds, theaterIds, startTimeRange: [day range]})
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
Customer <-- Frontend: Provide showtimes + remaining seat counts
@enduml
```

### 2.3. Seat Selection and Holding

```plantuml
@startuml
actor Customer

Customer -> Frontend: Select showtime
    Frontend -> Backend: Request ticket list\nGET /booking/showtimes/{showtimeId}/tickets
        Backend -> Booking: getTickets(showtimeId)
            Booking -> Showtimes: allExist([showtimeId])
            Booking <-- Showtimes: boolean
            Booking -> Tickets: search({showtimeIds: [showtimeId]})
            Booking <-- Tickets: TicketDto[]
        Backend <-- Booking: TicketDto[]
    Frontend <-- Backend: tickets[]
Customer <-- Frontend: Provide seat list

Customer -> Frontend: Select seats
    Frontend -> Backend: Hold tickets\nPATCH /booking/showtimes/{showtimeId}/tickets
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
                Atomic processing via Redis Lua script
                ttl = Rules.Ticket.holdDurationInMs (10 min)
            end note
            Booking <-- TicketHolding: boolean (success)
        Backend <-- Booking: { success: true }
    Frontend <-- Backend: Hold complete
Customer <-- Frontend: Seat hold confirmation
@enduml
```

### 2.4. Payment and Purchase Completion

The Temporal workflow (`purchaseWorkflow`) orchestrates the entire purchase flow. Each step executes as a Temporal Activity, and on failure, the compensation stack is executed in reverse order.

```plantuml
@startuml
actor Customer

Customer -> Frontend: Enter payment info and confirm purchase
    Frontend -> Backend: Payment request\nPOST /purchases
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
                    note right: Max 10 tickets
                    TicketPurchase -> TicketPurchase: validatePurchaseTime(showtimes)
                    note right: Up to 30 min before showtime
                    TicketPurchase -> TicketHolding: searchHeldTicketIds(showtimeId, customerId)
                    TicketPurchase <-- TicketHolding: heldTicketIds[]
                    TicketPurchase -> TicketPurchase: Verify all tickets are in held status
                Temporal <-- TicketPurchase: void (validation complete)
                deactivate TicketPurchase

                Temporal -> Payments: [Activity] createPayment(totalPrice, customerId)
                Temporal <-- Payments: PaymentDto
                note right: Register cancelPayment in compensation stack

                Temporal -> PurchaseRecords: [Activity] createPurchaseRecord({...dto, paymentId})
                Temporal <-- PurchaseRecords: PurchaseRecordDto
                note right: Register deletePurchaseRecord in compensation stack

                Temporal -> TicketPurchase: [Activity] completePurchase(dto)
                activate TicketPurchase
                    TicketPurchase -> Tickets: updateStatusMany(ticketIds, TicketStatus.Sold)
                    TicketPurchase <-- Tickets: TicketDto[]
                    TicketPurchase -> Events: emitTicketPurchased(customerId, ticketIds)
                    note left: WatchRecords subscribes to this event
                Temporal <-- TicketPurchase: void
                deactivate TicketPurchase
            end box

            Purchase <-- Temporal: PurchaseRecordDto
        Backend <-- Purchase: PurchaseRecordDto
    Frontend <-- Backend: Purchase completion info
Customer <-- Frontend: Purchase confirmation
@enduml
```

---

## 3. Rollback Handling (Temporal Compensation Stack)

When an exception occurs during workflow execution, the compensation stack is executed in reverse order.

```plantuml
@startuml
[o-> Workflow: Exception occurred

Workflow -> Workflow: Execute compensation stack in reverse
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

> The compensation stack only cancels successfully completed Activities in reverse order. For example, if only `createPayment` succeeded, only `cancelPayment` is executed and `deletePurchaseRecord` is not.
