import { SeatmapSchema, TheaterLocationSchema } from '../models/index.js'
import { z } from 'zod'

export const TheaterSchema = z.strictObject({
    id: z.string(),
    location: TheaterLocationSchema,
    name: z.string(),
    seatmap: SeatmapSchema
})

export type TheaterDto = z.infer<typeof TheaterSchema>
