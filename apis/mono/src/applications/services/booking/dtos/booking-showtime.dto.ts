import { ShowtimeDto, TicketSalesDto } from 'cores'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
