import { PaginationSchema } from '@mannercode/common'
import { z } from 'zod'
import { MovieGenre, MovieRating } from '../models/index.js'

const dateFromInput = z.union([z.date(), z.string(), z.number(), z.boolean()]).pipe(z.coerce.date())

export const SearchMoviesPageSchema = PaginationSchema.extend({
    director: z.string().nullish(),
    genre: z.enum(MovieGenre).nullish(),
    plot: z.string().nullish(),
    rating: z.enum(MovieRating).nullish(),
    releaseDate: dateFromInput.nullish(),
    title: z.string().nullish()
})

export type SearchMoviesPageDto = z.infer<typeof SearchMoviesPageSchema>
