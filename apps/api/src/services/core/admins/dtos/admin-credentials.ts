import { z } from 'zod'
import { stringFromRequest } from './request-value.schema.js'

export const AdminCredentialsSchema = z.strictObject({
    email: stringFromRequest.pipe(z.email()),
    password: stringFromRequest
})

export type AdminCredentialsDto = z.infer<typeof AdminCredentialsSchema>
