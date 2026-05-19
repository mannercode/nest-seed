import { DateUtil } from '@mannercode/common'
import { createMovie, createShowtimes, createTheater, type AppTestContext } from '../helpers'

type HomeResponse = {
    movies: {
        movie: { id: string; title: string }
        upcomingShowtimes: { id: string; theater: { id: string; name: string } }[]
    }[]
}

describe('UserHomeView', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })

    afterEach(() => fix.teardown())

    describe('GET /views/user-app/home', () => {
        it('상영 예정이 없으면 빈 목록을 반환한다', async () => {
            const { body } = await fix.httpClient.get('/views/user-app/home').ok()

            expect(body).toEqual({ movies: [] })
        })

        it('상영 예정이 없는 영화는 카드에서 제외한다', async () => {
            await createMovie(fix, { title: 'Home Only Movie' })

            const { body } = await fix.httpClient.get('/views/user-app/home').ok()

            expect(body).toEqual({ movies: [] })
        })

        it('영화 카드에 가까운 상영을 시간순으로 최대 3개까지 포함한다', async () => {
            const movie = await createMovie(fix, { title: 'Home Movie' })
            const theaterA = await createTheater(fix, { name: 'Home Theater A' })
            const theaterB = await createTheater(fix, { name: 'Home Theater B' })

            const now = new Date()
            const past = DateUtil.add({ base: now, days: -1 })
            const t1 = DateUtil.add({ base: now, days: 1 })
            const t2 = DateUtil.add({ base: now, days: 2 })
            const t3 = DateUtil.add({ base: now, days: 3 })
            const t4 = DateUtil.add({ base: now, days: 4 })

            const [pastShowtime] = await createShowtimes(fix, [
                { movieId: movie.id, startTime: past, theaterId: theaterA.id }
            ])
            const [s1] = await createShowtimes(fix, [
                { movieId: movie.id, startTime: t1, theaterId: theaterA.id }
            ])
            const [s2] = await createShowtimes(fix, [
                { movieId: movie.id, startTime: t2, theaterId: theaterB.id }
            ])
            const [s3] = await createShowtimes(fix, [
                { movieId: movie.id, startTime: t3, theaterId: theaterA.id }
            ])
            await createShowtimes(fix, [
                { movieId: movie.id, startTime: t4, theaterId: theaterB.id }
            ])

            const { body } = await fix.httpClient.get('/views/user-app/home').ok()
            const home = body as HomeResponse

            expect(home.movies).toHaveLength(1)
            const card = home.movies[0]
            expect(card.movie.title).toBe('Home Movie')
            expect(card.upcomingShowtimes.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id])
            expect(card.upcomingShowtimes.map((s) => s.id)).not.toContain(pastShowtime.id)
            expect(card.upcomingShowtimes.map((s) => s.theater.name)).toEqual([
                theaterA.name,
                theaterB.name,
                theaterA.name
            ])
        })
    })
})
