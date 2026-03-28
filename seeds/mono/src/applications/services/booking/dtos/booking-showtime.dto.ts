import type { TicketSalesDto } from 'cores'
import { ShowtimeDto } from 'cores'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
