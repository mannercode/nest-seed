import { Seat } from '../../theaters'
import { Ticket } from '../models'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    seat: Seat
    status: string

    constructor(ticket: Ticket) {
        const { createdAt, updatedAt, __v, batchId, ...rest } = ticket

        Object.assign(this, rest)
    }
}
