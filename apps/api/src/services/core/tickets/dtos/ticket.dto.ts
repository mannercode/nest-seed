import { TicketStatus } from '../models/index.js'
import { z } from 'zod'

export const TicketSchema = z.strictObject({
    id: z.string(),
    movieId: z.string(),
    seat: z.strictObject({ block: z.string(), row: z.string(), seatNumber: z.number() }),
    showtimeId: z.string(),
    status: z.enum(TicketStatus),
    theaterId: z.string()
})

export type TicketDto = z.infer<typeof TicketSchema>
