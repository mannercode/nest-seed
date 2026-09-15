import type { z } from 'zod'
import { CreateTheaterSchema } from './create-theater.dto.js'

export const UpdateTheaterSchema = CreateTheaterSchema.partial()

export type UpdateTheaterDto = z.infer<typeof UpdateTheaterSchema>
