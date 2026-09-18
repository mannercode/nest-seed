import { PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const CreateUserSchema = z.strictObject({
    birthDate: PlainDateFromInputSchema,
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(1)
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>
