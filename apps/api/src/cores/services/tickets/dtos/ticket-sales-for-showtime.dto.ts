import { TicketSalesDto } from './ticket-sales.dto'

/**
 * TicketSalesForShowtimeDto 대신 ShowtimeTicketSalesDto를 고려했으나
 * 복수형을 표현할 때 TicketSalesForShowtimeDto가 유리해서 선택함
 * 복수형: ticketSalesForShowtimes vs showtimeTicketSales
 */
export class TicketSalesForShowtimeDto extends TicketSalesDto {
    showtimeId: string
}
