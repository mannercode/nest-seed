import { z } from 'zod'
import { CreateUserSchema } from './create-user.dto.js'

export const UpdateUserSchema = z.strictObject({
    birthDate: CreateUserSchema.shape.birthDate.optional(),
    email: CreateUserSchema.shape.email.optional(),
    name: CreateUserSchema.shape.name.optional(),
    password: CreateUserSchema.shape.password.optional()
})

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
