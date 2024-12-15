import { ShowtimeDto } from '../showtimes'
import { TicketSalesStatusDto } from '../tickets'

export type ShowtimeSalesStatusDto = ShowtimeDto & { salesStatus: TicketSalesStatusDto }
