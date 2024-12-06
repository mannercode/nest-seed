import { Seat } from "services/theaters"
import { TicketStatus } from "../models"

export class TicketDto {
    id: string
    showtimeId: string
    theaterId: string
    movieId: string
    status: TicketStatus
    seat: Seat
}
