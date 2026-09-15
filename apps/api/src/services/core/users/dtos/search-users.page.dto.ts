import { z } from 'zod'
import { PaginationSchema } from '@mannercode/common'

export const SearchUsersPageSchema = PaginationSchema.extend({
    email: z.string().nullish(),
    name: z.string().nullish()
})

export type SearchUsersPageDto = z.infer<typeof SearchUsersPageSchema>
