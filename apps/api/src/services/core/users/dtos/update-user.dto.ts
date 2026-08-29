import { z } from 'zod'
import { CreateUserSchema } from './create-user.dto.js'

export const UpdateUserSchema = z.strictObject({
    birthDate: CreateUserSchema.shape.birthDate.nullish(),
    email: CreateUserSchema.shape.email.nullish(),
    name: CreateUserSchema.shape.name.nullish(),
    password: CreateUserSchema.shape.password.nullish()
})

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
