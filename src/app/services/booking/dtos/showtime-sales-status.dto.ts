import { ShowtimeDto } from 'services/showtimes'
import { TicketSalesStatusDto } from 'services/tickets'

export type ShowtimeSalesStatusDto = ShowtimeDto & { salesStatus: TicketSalesStatusDto }
