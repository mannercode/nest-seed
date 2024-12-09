import { ShowtimeDto, TicketSalesStatusDto } from 'services/core'

export type ShowtimeSalesStatusDto = ShowtimeDto & { salesStatus: TicketSalesStatusDto }
