import { z } from 'zod'
import { nonEmptyStringFromRequest } from './request-value.schema.js'

export const AdminRefreshTokenBodySchema = z.strictObject({
    refreshToken: nonEmptyStringFromRequest
})

export type AdminRefreshTokenBodyDto = z.infer<typeof AdminRefreshTokenBodySchema>
