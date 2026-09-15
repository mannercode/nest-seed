import { z } from 'zod'
import { SeatmapSchema, TheaterLocationSchema } from '../models/index.js'

export const CreateTheaterSchema = z.strictObject({
    location: TheaterLocationSchema,
    name: z.string().min(1),
    seatmap: SeatmapSchema
})

export type CreateTheaterDto = z.infer<typeof CreateTheaterSchema>
