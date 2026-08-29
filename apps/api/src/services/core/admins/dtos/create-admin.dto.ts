import { z } from 'zod'
import { nonEmptyStringFromRequest, stringFromRequest } from './request-value.schema.js'

export const CreateAdminSchema = z.strictObject({
    email: stringFromRequest.pipe(z.email()),
    name: nonEmptyStringFromRequest,
    password: nonEmptyStringFromRequest
})

export type CreateAdminDto = z.infer<typeof CreateAdminSchema>
