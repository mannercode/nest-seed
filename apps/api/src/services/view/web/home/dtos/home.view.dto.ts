import { z } from 'zod'
import { UserSchema } from '#core'

export const WebHomeViewSchema = z.strictObject({
    user: UserSchema,
    photoUrl: z.string().nullable()
})
export type WebHomeView = z.infer<typeof WebHomeViewSchema>
