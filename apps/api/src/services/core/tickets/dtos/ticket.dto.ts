import type { SeatPosition, TicketStatus } from '../models/index.js'

export class TicketDto {
    id: string
    movieId: string
    seat: SeatPosition
    showtimeId: string
    status: TicketStatus
    theaterId: string
}
