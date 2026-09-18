import { z } from 'zod'

export const TicketSalesSchema = z.strictObject({
    available: z.number(),
    sold: z.number(),
    total: z.number()
})

export type TicketSalesDto = z.infer<typeof TicketSalesSchema>
