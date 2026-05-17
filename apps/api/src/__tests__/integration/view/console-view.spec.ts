import { DateUtil } from '@mannercode/common'
import { createMovie, createShowtimes, createTheater, type AppTestContext } from '../helpers'

type ConsoleMoviesResponse = {
    items: {
        movie: { id: string; title: string }
        showtimes: { id: string; theater: { id: string; name: string } }[]
    }[]
    page: number
    size: number
    total: number
}

describe('Console view', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })

    afterEach(() => fix.teardown())

    describe('GET /views/console/movies', () => {
        it('영화가 없으면 빈 페이지를 반환한다', async () => {
            const { body } = await fix.httpClient.get('/views/console/movies?size=10').ok()

            expect(body).toEqual({ items: [], page: 1, size: 10, total: 0 })
        })

        it('상영시간이 없는 영화는 빈 상영시간 배열을 내려준다', async () => {
            const movie = await createMovie(fix, { title: 'Console Empty Schedule' })

            const { body } = await fix.httpClient.get('/views/console/movies?size=10').ok()
            const view = body as ConsoleMoviesResponse

            expect(view.total).toBe(1)
            expect(view.items).toEqual([
                expect.objectContaining({
                    movie: expect.objectContaining({
                        id: movie.id,
                        title: 'Console Empty Schedule'
                    }),
                    showtimes: []
                })
            ])
        })

        it('영화 목록에 예정 상영시간과 극장 이름을 함께 내려준다', async () => {
            const movieWithShowtimes = await createMovie(fix, { title: 'Console Alpha' })
            const movieWithoutShowtimes = await createMovie(fix, { title: 'Console Beta' })
            const theaterA = await createTheater(fix, { name: 'Console Theater A' })
            const theaterB = await createTheater(fix, { name: 'Console Theater B' })

            const now = new Date()
            const pastStart = DateUtil.add({ base: now, days: -1 })
            const firstStart = DateUtil.add({ base: now, days: 1 })
            const secondStart = DateUtil.add({ base: now, days: 2 })

            const [pastShowtime] = await createShowtimes(fix, [
                { movieId: movieWithShowtimes.id, startTime: pastStart, theaterId: theaterA.id }
            ])
            const [firstShowtime] = await createShowtimes(fix, [
                { movieId: movieWithShowtimes.id, startTime: firstStart, theaterId: theaterA.id }
            ])
            const [secondShowtime] = await createShowtimes(fix, [
                { movieId: movieWithShowtimes.id, startTime: secondStart, theaterId: theaterB.id }
            ])

            const { body } = await fix.httpClient
                .get('/views/console/movies?size=10&orderby=title:asc')
                .ok()
            const view = body as ConsoleMoviesResponse

            expect(view).toEqual(
                expect.objectContaining({
                    page: expect.any(Number),
                    size: expect.any(Number),
                    total: 2
                })
            )

            const alpha = view.items.find((item) => item.movie.id === movieWithShowtimes.id)
            const beta = view.items.find((item) => item.movie.id === movieWithoutShowtimes.id)

            expect(alpha).toBeDefined()
            expect(beta).toBeDefined()
            if (!alpha || !beta) throw new Error('console movie view item missing')

            expect(alpha.movie.title).toBe('Console Alpha')
            expect(alpha.showtimes.map((showtime) => showtime.id)).toEqual([
                firstShowtime.id,
                secondShowtime.id
            ])
            expect(alpha.showtimes.map((showtime) => showtime.theater)).toEqual([
                { id: theaterA.id, name: theaterA.name },
                { id: theaterB.id, name: theaterB.name }
            ])
            expect(alpha.showtimes.map((showtime) => showtime.id)).not.toContain(pastShowtime.id)
            expect(beta.movie.title).toBe('Console Beta')
            expect(beta.showtimes).toEqual([])
        })
    })
})
