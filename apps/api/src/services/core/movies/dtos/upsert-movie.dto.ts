import { z } from 'zod'
import { MovieGenre, MovieRating } from '../models/index.js'

const dateFromInput = z.union([z.date(), z.string(), z.number(), z.boolean()]).pipe(z.coerce.date())
const integerFromInput = z
    .union([z.number(), z.string(), z.boolean()])
    .transform(Number)
    .pipe(z.number().int())
const stringFromInput = z.union([z.string(), z.number(), z.boolean()]).transform(String)

export const UpsertMovieSchema = z.strictObject({
    assetIds: z.array(z.string()).nullish(),
    director: stringFromInput.nullish(),
    durationInSeconds: integerFromInput.nullish(),
    genres: z.array(z.enum(MovieGenre)).nullish(),
    plot: stringFromInput.pipe(z.string().max(5000)).nullish(),
    rating: z.enum(MovieRating).nullish(),
    releaseDate: dateFromInput.nullish(),
    title: stringFromInput.nullish()
})

export type UpsertMovieDto = z.infer<typeof UpsertMovieSchema>
