import type { SeatPosition, TicketStatus } from '../models'

export class TicketDto {
    id: string
    movieId: string
    seat: SeatPosition
    showtimeId: string
    status: TicketStatus
    theaterId: string
}
