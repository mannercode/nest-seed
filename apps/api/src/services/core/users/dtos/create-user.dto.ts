import { z } from 'zod'
import {
    dateFromRequest,
    nonEmptyStringFromRequest,
    stringFromRequest
} from './request-value.schema.js'

export const CreateUserSchema = z.strictObject({
    birthDate: dateFromRequest,
    email: stringFromRequest.pipe(z.email()),
    name: nonEmptyStringFromRequest,
    password: nonEmptyStringFromRequest
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>
