import type { z } from 'zod'
import { CreateAdminSchema } from './create-admin.dto.js'

export const UpdateAdminSchema = CreateAdminSchema.partial()

export type UpdateAdminDto = z.infer<typeof UpdateAdminSchema>
