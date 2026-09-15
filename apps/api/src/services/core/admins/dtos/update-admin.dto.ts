import { z } from 'zod'
import { CreateAdminSchema } from './create-admin.dto.js'

export const UpdateAdminSchema = z.strictObject({
    email: CreateAdminSchema.shape.email.optional(),
    name: CreateAdminSchema.shape.name.optional(),
    password: CreateAdminSchema.shape.password.optional()
})

export type UpdateAdminDto = z.infer<typeof UpdateAdminSchema>
