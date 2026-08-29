import type { z } from 'zod'
import { CreateTheaterSchema } from './create-theater.dto.js'

export const UpdateTheaterSchema = CreateTheaterSchema.extend({
    location: CreateTheaterSchema.shape.location.nullish(),
    name: CreateTheaterSchema.shape.name.nullish(),
    seatmap: CreateTheaterSchema.shape.seatmap.nullish()
})

export type UpdateTheaterDto = z.infer<typeof UpdateTheaterSchema>
