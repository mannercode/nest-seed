import { BulkCreateShowtimesSchema } from '../index.js'

describe('showtime creation request schemas', () => {
    it('중복된 극장 ID를 거부한다', () => {
        expect(
            BulkCreateShowtimesSchema.safeParse({
                durationInMinutes: 90,
                movieId: 'movie-id',
                startTimes: [new Date('2100-01-01T09:00:00.000Z')],
                theaterIds: ['theater-id', 'theater-id']
            }).success
        ).toBe(false)
    })
})
