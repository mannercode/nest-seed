import type { Seat } from '../../theaters'
import type { TicketStatus } from '../models'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
