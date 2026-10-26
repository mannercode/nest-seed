import type { z } from 'zod'
import { CreateUserSchema } from './create-user.dto.js'

export const UserCredentialsSchema = CreateUserSchema.pick({ email: true, password: true })

export type UserCredentialsDto = z.infer<typeof UserCredentialsSchema>
