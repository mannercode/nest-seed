import { z } from 'zod'

export const RefreshTokenBodySchema = z.strictObject({ refreshToken: z.string().min(1) })

export type RefreshTokenBodyDto = z.infer<typeof RefreshTokenBodySchema>
