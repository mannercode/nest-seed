import { BaseDto } from 'common'

export class TicketSalesStatusDto extends BaseDto {
    total: number
    sold: number
    available: number
}

export class SalesStatusByShowtimeDto extends TicketSalesStatusDto {
    showtimeId: string
}
