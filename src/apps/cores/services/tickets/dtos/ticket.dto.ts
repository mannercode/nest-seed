import type { Seat } from '../../theaters'
import type { TicketStatus } from '../models'

export class TicketDto {
    id: string
    movieId: string
    seat: Seat
    showtimeId: string
    status: TicketStatus
    theaterId: string
}
