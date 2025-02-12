import { Seat } from '../../theaters'
import { TicketStatus } from '../models'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
