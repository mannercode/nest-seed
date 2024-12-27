import { ShowtimeDto, TicketSalesStatusDto } from 'cores'

export class ShowtimeSalesStatusDto extends ShowtimeDto {
    salesStatus: TicketSalesStatusDto
}
