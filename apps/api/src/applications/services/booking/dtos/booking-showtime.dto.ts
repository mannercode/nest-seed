import { ShowtimeDto, type TicketSalesDto } from 'cores'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
