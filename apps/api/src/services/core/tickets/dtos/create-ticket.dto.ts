import type { SeatPosition, TicketStatus } from '../models/index.js'

export class CreateTicketDto {
    movieId: string

    sagaId: string

    seat: SeatPosition

    showtimeId: string

    status: TicketStatus

    theaterId: string
}
