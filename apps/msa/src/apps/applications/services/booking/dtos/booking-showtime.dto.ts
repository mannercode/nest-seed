import type { TicketSalesDto } from 'apps/cores'
import { ShowtimeDto } from 'apps/cores'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
