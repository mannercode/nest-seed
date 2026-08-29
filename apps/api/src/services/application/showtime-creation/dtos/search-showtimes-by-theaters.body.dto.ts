import { z } from 'zod'

export const SearchShowtimesByTheatersBodySchema = z.strictObject({
    theaterIds: z.array(z.string()).min(1)
})

export type SearchShowtimesByTheatersBodyDto = z.infer<typeof SearchShowtimesByTheatersBodySchema>
