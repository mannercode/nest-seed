import { PaginationSchema } from '@mannercode/common'
import { z } from 'zod'

export const SearchTheatersPageSchema = PaginationSchema.extend({ name: z.string().nullish() })

export type SearchTheatersPageDto = z.infer<typeof SearchTheatersPageSchema>
