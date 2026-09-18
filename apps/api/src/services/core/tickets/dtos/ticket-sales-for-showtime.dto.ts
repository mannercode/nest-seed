import { z } from 'zod'
import { TicketSalesSchema } from './ticket-sales.dto.js'

export const TicketSalesForShowtimeSchema = TicketSalesSchema.extend({ showtimeId: z.string() })

export type TicketSalesForShowtimeDto = z.infer<typeof TicketSalesForShowtimeSchema>
