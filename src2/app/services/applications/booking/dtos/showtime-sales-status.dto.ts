import { ShowtimeDto, TicketSalesStatusDto } from 'services/cores'

export type ShowtimeSalesStatusDto = ShowtimeDto & { salesStatus: TicketSalesStatusDto }
