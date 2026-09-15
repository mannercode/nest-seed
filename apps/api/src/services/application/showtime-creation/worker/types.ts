import { z } from 'zod'
import { BulkCreateShowtimesSchema } from '../dtos/index.js'

export const ShowtimeCreationWorkflowInputSchema = z.object({
    createDto: BulkCreateShowtimesSchema,
    sagaId: z.string()
})
export type ShowtimeCreationWorkflowInput = z.infer<typeof ShowtimeCreationWorkflowInputSchema>
