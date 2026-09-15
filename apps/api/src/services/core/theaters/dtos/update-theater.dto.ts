import type { z } from 'zod'
import { CreateTheaterSchema } from './create-theater.dto.js'

export const UpdateTheaterSchema = CreateTheaterSchema.extend({
    location: CreateTheaterSchema.shape.location.optional(),
    name: CreateTheaterSchema.shape.name.optional(),
    seatmap: CreateTheaterSchema.shape.seatmap.optional()
})

export type UpdateTheaterDto = z.infer<typeof UpdateTheaterSchema>
