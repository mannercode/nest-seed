import { ShowtimeDto, TicketSalesDto } from 'apps/cores'

export class ShowtimeForBookingDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
