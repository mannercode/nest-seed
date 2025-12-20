import { ShowtimeDto } from 'apps/cores'
import type { TicketSalesDto } from 'apps/cores'

export class ShowtimeForBookingDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
