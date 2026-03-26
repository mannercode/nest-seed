> **English** | [한국어](../../ko/designs/entities.md)

# Entity Design

All entities share the following common fields.

| Field       | Type   |
| ----------- | ------ |
| `id`        | string |
| `createdAt` | Date   |
| `updatedAt` | Date   |

`id` is a virtual field where Mongoose converts MongoDB's `_id: ObjectId` to `string`. All ID fields referencing other entities (`movieId`, `customerId`, etc.) are also stored as `string` type. Since each service in an MSA can have its own independent data store, IDs are exchanged between services as strings to avoid depending on specific DB ID implementations (MongoDB ObjectId, UUID, auto-increment, etc.).

## ER Diagram

```plantuml
@startuml
skinparam linetype ortho

entity "Customer" {
    email : string <<unique>>
    name : string
    birthDate : Date
    password : string
}

entity "Movie" {
    title : string
    director : string
    plot : string
    rating : MovieRating
    genres : MovieGenre[]
    releaseDate : Date
    durationInSeconds : number
    isPublished : boolean
    assetIds : string[]|null
}

entity "Theater" {
    name : string
    location : TheaterLocation
    seatmap : Seatmap
}

entity "Showtime" {
    movieId : string
    theaterId : string
    startTime : Date
    endTime : Date
    sagaId : string
}

entity "Ticket" {
    showtimeId : string
    movieId : string
    theaterId : string
    seat : Seat
    status : TicketStatus
    sagaId : string
}

entity "PurchaseRecord" {
    customerId : string
    purchaseItems : PurchaseItem[]
    totalPrice : number
    paymentId : string|null
}

entity "WatchRecord" {
    customerId : string
    movieId : string
    purchaseRecordId : string
    watchDate : Date
}

entity "Payment" {
    customerId : string
    amount : number
}

entity "Asset" {
    originalName : string
    mimeType : string
    size : number
    checksum : Checksum
    ownerService : string|null
    ownerEntityId : string|null
}

Movie --{ Showtime : movieId
Theater --{ Showtime : theaterId
Showtime --{ Ticket : showtimeId
Movie .left.{ Ticket : movieId (denorm)
Theater .right.{ Ticket : theaterId (denorm)
Customer --{ PurchaseRecord : customerId
PurchaseRecord .right.{ Ticket : "purchaseItems[].itemId"
Customer --{ WatchRecord : customerId
Movie --{ WatchRecord : movieId
PurchaseRecord -- Payment : paymentId
PurchaseRecord --{ WatchRecord : purchaseRecordId
Movie --{ Asset : "assetIds[]"

@enduml
```

## Notes

- Customer `password` — bcrypt hash, excluded from queries by default
- MovieRating — `G` `PG` `PG13` `R` `NC17` `Unrated`
- MovieGenre — `action` `comedy` `drama` `fantasy` `horror` `mystery` `romance` `thriller` `western`
- TicketStatus — `Available = 'available'` `Sold = 'sold'`
- PurchaseItemType — `tickets` `foods`
- TheaterLocation — `{ latitude, longitude }`
- Seatmap — `SeatBlock[] > SeatRow[]`, layout: `X` = empty space, others = seats
- Seat — `{ block, row, seatNumber }`
- PurchaseItem — `{ itemId, type: PurchaseItemType }`
- Checksum — `{ algorithm, base64 }`, algorithm: `sha1` | `sha256`
- Asset lifecycle — issue presigned URL → upload → finalize → assign owner (incomplete uploads are cleaned up every 10 minutes)
