import { z } from 'zod'

export const UserAuthPayloadSchema = z.object({ sub: z.string(), email: z.email() })

export type UserAuthPayload = z.infer<typeof UserAuthPayloadSchema>
