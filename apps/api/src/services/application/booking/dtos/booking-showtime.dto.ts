import { ShowtimeDto, type TicketSalesDto } from 'core'

export class BookingShowtimeDto extends ShowtimeDto {
    ticketSales: TicketSalesDto
}
