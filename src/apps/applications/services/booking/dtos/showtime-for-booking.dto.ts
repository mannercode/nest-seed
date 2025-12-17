import type { TicketSalesDto } from 'apps/cores'
import { ShowtimeDto } from 'apps/cores'

export class ShowtimeForBookingDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
