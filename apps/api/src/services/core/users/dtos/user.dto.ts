import { PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const UserSchema = z.strictObject({
    birthDate: PlainDateFromInputSchema,
    email: z.string(),
    id: z.string(),
    name: z.string()
})

export type UserDto = z.infer<typeof UserSchema>
