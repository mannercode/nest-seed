import { z } from 'zod'

export const AdminAuthPayloadSchema = z.object({
    authVersion: z.number().int(),
    sub: z.string(),
    email: z.email()
})

export type AdminAuthPayload = z.infer<typeof AdminAuthPayloadSchema>
