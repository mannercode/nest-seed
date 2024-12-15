export class TicketSalesStatusDto {
    total: number
    sold: number
    available: number
}

export class SalesStatusByShowtimeDto extends TicketSalesStatusDto {
    showtimeId: string
}
