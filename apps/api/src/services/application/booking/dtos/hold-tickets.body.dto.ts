import { z } from 'zod'

export const HoldTicketsBodySchema = z.strictObject({ ticketIds: z.array(z.string()).min(1) })

export type HoldTicketsBodyDto = z.infer<typeof HoldTicketsBodySchema>
