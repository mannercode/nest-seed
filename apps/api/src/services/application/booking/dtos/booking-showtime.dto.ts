import type { z } from 'zod'
import { ShowtimeSchema, TicketSalesSchema } from '#core'

export const BookingShowtimeSchema = ShowtimeSchema.extend({ ticketSales: TicketSalesSchema })

export type BookingShowtimeDto = z.infer<typeof BookingShowtimeSchema>
