import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const ShowtimeSchema = z.strictObject({
    endTime: InstantFromInputSchema,
    id: z.string(),
    movieId: z.string(),
    startTime: InstantFromInputSchema,
    theaterId: z.string()
})

export type ShowtimeDto = z.infer<typeof ShowtimeSchema>
