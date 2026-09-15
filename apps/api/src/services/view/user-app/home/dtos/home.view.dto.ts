import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'
import { MovieSchema } from '#core'

export const HomeShowtimeViewSchema = z.strictObject({
    endTime: InstantFromInputSchema,
    id: z.string(),
    startTime: InstantFromInputSchema,
    theater: z.strictObject({ id: z.string(), name: z.string() })
})
export type HomeShowtimeView = z.infer<typeof HomeShowtimeViewSchema>

export const HomeMovieCardSchema = z.strictObject({
    movie: MovieSchema,
    upcomingShowtimes: z.array(HomeShowtimeViewSchema)
})
export type HomeMovieCard = z.infer<typeof HomeMovieCardSchema>

export const UserHomeViewSchema = z.strictObject({
    showingMovies: z.array(HomeMovieCardSchema),
    recommendedMovies: z.array(MovieSchema)
})
export type UserHomeView = z.infer<typeof UserHomeViewSchema>
