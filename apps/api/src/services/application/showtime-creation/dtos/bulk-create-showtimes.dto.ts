import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const BulkCreateShowtimesSchema = z.strictObject({
    durationInMinutes: z.number().positive(),
    movieId: z.string().min(1),
    startTimes: z.array(InstantFromInputSchema).min(1),
    theaterIds: z
        .array(z.string())
        .min(1)
        .refine((ids) => new Set(ids).size === ids.length, 'Duplicate theater IDs are not allowed')
})

export type BulkCreateShowtimesDto = z.infer<typeof BulkCreateShowtimesSchema>
