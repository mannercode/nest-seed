import { DateUtil, ensure } from '@mannercode/common'
import { createMovie, createShowtimes, createTheater, type AppTestContext } from '../helpers'

type HomeResponse = {
    movies: {
        movie: { id: string; title: string }
        upcomingShowtimes: { id: string; theater: { id: string; name: string } }[]
    }[]
}

type ShowtimeFixture = NonNullable<Awaited<ReturnType<typeof createShowtimes>>[number]>

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

        describe('가까운 상영이 여러 개 있을 때', () => {
            let theaterA: Awaited<ReturnType<typeof createTheater>>
            let theaterB: Awaited<ReturnType<typeof createTheater>>
            let pastShowtime: ShowtimeFixture
            let s1: ShowtimeFixture
            let s2: ShowtimeFixture
            let s3: ShowtimeFixture
            let s4: ShowtimeFixture

            beforeEach(async () => {
                const movie = await createMovie(fix, { title: 'Home Movie' })
                theaterA = await createTheater(fix, { name: 'Home Theater A' })
                theaterB = await createTheater(fix, { name: 'Home Theater B' })

                const now = new Date()
                const past = DateUtil.add({ base: now, days: -1 })
                const t1 = DateUtil.add({ base: now, days: 1 })
                const t2 = DateUtil.add({ base: now, days: 2 })
                const t3 = DateUtil.add({ base: now, days: 3 })
                const t4 = DateUtil.add({ base: now, days: 4 })

                pastShowtime = ensure(
                    (
                        await createShowtimes(fix, [
                            { movieId: movie.id, startTime: past, theaterId: theaterA.id }
                        ])
                    )[0]
                )
                s1 = ensure(
                    (
                        await createShowtimes(fix, [
                            { movieId: movie.id, startTime: t1, theaterId: theaterA.id }
                        ])
                    )[0]
                )
                s2 = ensure(
                    (
                        await createShowtimes(fix, [
                            { movieId: movie.id, startTime: t2, theaterId: theaterB.id }
                        ])
                    )[0]
                )
                s3 = ensure(
                    (
                        await createShowtimes(fix, [
                            { movieId: movie.id, startTime: t3, theaterId: theaterA.id }
                        ])
                    )[0]
                )
                s4 = ensure(
                    (
                        await createShowtimes(fix, [
                            { movieId: movie.id, startTime: t4, theaterId: theaterB.id }
                        ])
                    )[0]
                )
            })

            it('가까운 상영을 시작 시각순으로 정렬한다', async () => {
                const { body } = await fix.httpClient.get('/views/user-app/home').ok()
                const home = body as HomeResponse

                const card = ensure(home.movies[0])
                expect(card.upcomingShowtimes.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id])
                expect(card.upcomingShowtimes.map((s) => s.theater.name)).toEqual([
                    theaterA.name,
                    theaterB.name,
                    theaterA.name
                ])
            })

            it('영화당 상영을 최대 3개까지만 포함한다', async () => {
                const { body } = await fix.httpClient.get('/views/user-app/home').ok()
                const home = body as HomeResponse

                expect(home.movies).toHaveLength(1)
                const card = ensure(home.movies[0])
                expect(card.movie.title).toBe('Home Movie')
                expect(card.upcomingShowtimes).toHaveLength(3)
                expect(card.upcomingShowtimes.map((s) => s.id)).not.toContain(s4.id)
            })

            it('이미 지난 상영은 카드에서 제외한다', async () => {
                const { body } = await fix.httpClient.get('/views/user-app/home').ok()
                const home = body as HomeResponse

                const card = ensure(home.movies[0])
                expect(card.upcomingShowtimes.map((s) => s.id)).not.toContain(pastShowtime.id)
            })
        })
    })
})
