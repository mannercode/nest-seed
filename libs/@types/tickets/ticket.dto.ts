import { Seat } from '../theaters'

export enum TicketStatus {
    available = 'available',
    sold = 'sold'
}

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
