/* istanbul ignore file */

import { ShowtimeDto } from 'services/showtimes'
import { TicketSalesStatusDto } from 'services/tickets'

export class ShowtimeSalesStatusDto extends ShowtimeDto {
    salesStatus: TicketSalesStatusDto
}
