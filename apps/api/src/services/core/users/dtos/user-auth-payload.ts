import { z } from 'zod'

export const UserAuthPayloadSchema = z.object({
    authVersion: z.number().int(),
    sub: z.string(),
    email: z.email()
})

export type UserAuthPayload = z.infer<typeof UserAuthPayloadSchema>
