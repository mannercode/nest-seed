import { z } from 'zod'

export const stringFromRequest = z
    .union([z.string(), z.number(), z.boolean()])
    .pipe(z.coerce.string())

export const nonEmptyStringFromRequest = stringFromRequest.pipe(z.string().min(1))
