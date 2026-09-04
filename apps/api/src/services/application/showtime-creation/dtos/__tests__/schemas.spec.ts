import { BulkCreateShowtimesSchema } from '../index.js'

describe('BulkCreateShowtimesSchema', () => {
    it('한쪽 배열이 20개를 넘어도 전체 상영 수가 안전 상한 이하면 허용한다', () => {
        expect(
            BulkCreateShowtimesSchema.safeParse({
                durationInMinutes: 90,
                movieId: 'movie-id',
                startTimes: ['2100-01-01T09:00:00.000Z'],
                theaterIds: Array.from({ length: 21 }, (_, index) => `theater-${index}`)
            }).success
        ).toBe(true)
    })

    it('중복된 극장 ID를 거부한다', () => {
        expect(
            BulkCreateShowtimesSchema.safeParse({
                durationInMinutes: 90,
                movieId: 'movie-id',
                startTimes: ['2100-01-01T09:00:00.000Z'],
                theaterIds: ['theater-id', 'theater-id']
            }).success
        ).toBe(false)
    })
})
