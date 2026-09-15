import { z } from 'zod'

export const AdminRefreshTokenBodySchema = z.strictObject({ refreshToken: z.string().min(1) })

export type AdminRefreshTokenBodyDto = z.infer<typeof AdminRefreshTokenBodySchema>
