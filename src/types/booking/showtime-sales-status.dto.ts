import { ShowtimeDto } from '../showtimes'
import { TicketSalesStatusDto } from '../tickets'

export class ShowtimeSalesStatusDto extends ShowtimeDto {
    salesStatus: TicketSalesStatusDto
}
