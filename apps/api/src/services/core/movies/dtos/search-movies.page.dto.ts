import { PaginationSchema, PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'
import { MovieGenre, MovieRating } from '../models/index.js'

export const SearchMoviesPageSchema = PaginationSchema.extend({
    director: z.string().nullish(),
    genre: z.enum(MovieGenre).nullish(),
    plot: z.string().nullish(),
    rating: z.enum(MovieRating).nullish(),
    releaseDate: PlainDateFromInputSchema.nullish(),
    title: z.string().nullish()
})

export type SearchMoviesPageDto = z.infer<typeof SearchMoviesPageSchema>
