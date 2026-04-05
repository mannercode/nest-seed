import { ShowtimeDto, TicketSalesDto } from 'apps/cores'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
