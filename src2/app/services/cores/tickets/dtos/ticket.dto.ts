import { Seat } from 'services/cores/theaters'
import { TicketStatus } from '../models'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
