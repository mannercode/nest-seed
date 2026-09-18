import { PlainDateFromInputSchema } from '@mannercode/common'
import { MovieGenre, MovieRating } from '../models/index.js'
import { z } from 'zod'

export const MovieSchema = z.strictObject({
    director: z.string(),
    durationInSeconds: z.number(),
    genres: z.array(z.enum(MovieGenre)),
    id: z.string(),
    imageUrls: z.array(z.string()),
    plot: z.string(),
    rating: z.enum(MovieRating),
    releaseDate: PlainDateFromInputSchema,
    title: z.string()
})

export type MovieDto = z.infer<typeof MovieSchema>
