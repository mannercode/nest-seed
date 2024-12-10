import { Seat, TicketStatus } from 'services/types'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
