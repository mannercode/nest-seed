import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const WatchRecordSchema = z.strictObject({
    userId: z.string(),
    id: z.string(),
    movieId: z.string(),
    purchaseRecordId: z.string(),
    watchDate: InstantFromInputSchema
})

export type WatchRecordDto = z.infer<typeof WatchRecordSchema>
