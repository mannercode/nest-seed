import { z } from 'zod'
import { stringFromRequest } from './request-value.schema.js'

export const UserCredentialsSchema = z.strictObject({
    email: stringFromRequest.pipe(z.email()),
    password: stringFromRequest
})

export type UserCredentialsDto = z.infer<typeof UserCredentialsSchema>
