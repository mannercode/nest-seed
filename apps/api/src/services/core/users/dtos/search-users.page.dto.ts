import type { z } from 'zod'
import { PaginationSchema } from '@mannercode/common'
import { stringFromRequest } from './request-value.schema.js'

export const SearchUsersPageSchema = PaginationSchema.extend({
    email: stringFromRequest.nullish(),
    name: stringFromRequest.nullish()
})

export type SearchUsersPageDto = z.infer<typeof SearchUsersPageSchema>
