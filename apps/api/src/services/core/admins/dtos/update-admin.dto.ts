import { z } from 'zod'
import { CreateAdminSchema } from './create-admin.dto.js'

export const UpdateAdminSchema = z.strictObject({
    email: CreateAdminSchema.shape.email.nullish(),
    name: CreateAdminSchema.shape.name.nullish(),
    password: CreateAdminSchema.shape.password.nullish()
})

export type UpdateAdminDto = z.infer<typeof UpdateAdminSchema>
