import { BaseDto } from 'common'
import { Seat } from '../../theaters'
import { TicketStatus } from '../models'

export class TicketDto extends BaseDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
