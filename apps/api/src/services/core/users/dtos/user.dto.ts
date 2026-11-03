import { PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const UserSchema = z.strictObject({
    birthDate: PlainDateFromInputSchema,
    email: z.string(),
    id: z.string(),
    name: z.string(),
    photoAssetId: z.string().nullable()
})

export type UserDto = z.infer<typeof UserSchema>
