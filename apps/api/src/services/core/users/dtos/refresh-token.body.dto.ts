import { z } from 'zod'
import { nonEmptyStringFromRequest } from './request-value.schema.js'

export const RefreshTokenBodySchema = z.strictObject({ refreshToken: nonEmptyStringFromRequest })

export type RefreshTokenBodyDto = z.infer<typeof RefreshTokenBodySchema>
