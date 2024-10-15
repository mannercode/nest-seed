import { Seat } from '../../theaters'
import { Ticket } from '../schemas'

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    seat: Seat
    status: string

    constructor(ticket: Ticket) {
        const { id, showtimeId, theaterId, movieId, seat, status } = ticket

        Object.assign(this, {
            id: id.toString(),
            showtimeId: showtimeId.toString(),
            theaterId: theaterId.toString(),
            movieId: movieId.toString(),
            seat,
            status
        })
    }
}
