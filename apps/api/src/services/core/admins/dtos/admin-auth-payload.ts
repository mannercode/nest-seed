import { z } from 'zod'

export const AdminAuthPayloadSchema = z.object({ sub: z.string(), email: z.email() })

export type AdminAuthPayload = z.infer<typeof AdminAuthPayloadSchema>
