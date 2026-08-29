import { z } from 'zod'
import { SeatmapSchema, TheaterLocationSchema } from '../models/index.js'

const requiredString = z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .pipe(z.string().min(1))

export const CreateTheaterSchema = z.strictObject({
    location: TheaterLocationSchema,
    name: requiredString,
    seatmap: SeatmapSchema
})

export type CreateTheaterDto = z.infer<typeof CreateTheaterSchema>
