import { PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'
import { MovieGenre, MovieRating } from '../models/index.js'

export const UpsertMovieSchema = z.strictObject({
    director: z.string().optional(),
    durationInSeconds: z.number().int().optional(),
    genres: z.array(z.enum(MovieGenre)).optional(),
    plot: z.string().max(5000).optional(),
    rating: z.enum(MovieRating).optional(),
    releaseDate: PlainDateFromInputSchema.optional(),
    title: z.string().optional()
})

export type UpsertMovieDto = z.infer<typeof UpsertMovieSchema>
