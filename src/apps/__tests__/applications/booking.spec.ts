import { MovieDto, ShowtimeDto, TheaterDto, TicketDto, TicketStatus } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, step } from 'testlib'
import { Errors } from '../__helpers__'
import { createAllResources, type Fixture } from './booking.fixture'

describe('BookingService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./booking.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // 성공적인 예약 흐름인 경우
    describe('when the booking is successful', () => {
        let movie: MovieDto
        let accessToken: string

        const locations = [
            { latitude: 30.0, longitude: 130.0 },
            { latitude: 31.0, longitude: 131.0 },
            { latitude: 32.0, longitude: 132.0 },
            { latitude: 33.0, longitude: 133.0 },
            { latitude: 34.0, longitude: 134.0 }
        ]

        const startTimes = [
            new Date('2999-01-01T12:00'),
            new Date('2999-01-01T14:00'),
            new Date('2999-01-03T12:00'),
            new Date('2999-01-02T14:00')
        ]

        beforeEach(async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            movie = resources.movie
            accessToken = resources.accessToken
        })

        // 예약 절차를 완료한다
        it('completes the booking process', async () => {
            let theater: TheaterDto
            let showdate: Date
            let showtime: ShowtimeDto
            let tickets: TicketDto[]

            // 1. 상영 극장을 조회한다
            await step('searches theaters showing the movie', async () => {
                const latLong = '31.9,131.9'
                const { body: theaters } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters?latLong=${latLong}`)
                    .ok(
                        [
                            { location: locations[2] }, // distance = 0.1
                            { location: locations[1] }, // distance = 0.9
                            { location: locations[3] }, // distance = 1.1
                            { location: locations[0] }, // distance = 1.9
                            { location: locations[4] } // distance = 2.1
                        ].map((item) => expect.objectContaining(item))
                    )

                theater = theaters[0]
            })

            // 2. 상영일을 조회한다
            await step('searches showdates', async () => {
                const { body: showdates } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters/${theater.id}/showdates`)
                    .ok([new Date('2999-01-01'), new Date('2999-01-02'), new Date('2999-01-03')])

                showdate = showdates[0]
            })

            // 3. 상영시간을 조회한다
            await step('searches showtimes', async () => {
                const yymmdd = DateUtil.toYMD(showdate)
                const url = `/booking/movies/${movie.id}/theaters/${theater.id}/showdates/${yymmdd}/showtimes`

                const { body: showtimes } = await fix.httpClient.get(url).ok(
                    expect.arrayContaining(
                        [
                            { movieId: movie.id, theaterId: theater.id, startTime: startTimes[0] },
                            { movieId: movie.id, theaterId: theater.id, startTime: startTimes[1] }
                        ].map((item) => expect.objectContaining(item))
                    )
                )

                showtime = showtimes[0]
            })

            // 4. 구매 가능 티켓 조회한다
            await step('searches for available tickets', async () => {
                const { body } = await fix.httpClient
                    .get(`/booking/showtimes/${showtime.id}/tickets`)
                    .ok()

                tickets = body

                expect(tickets).toEqual(
                    Array(tickets.length).fill(
                        expect.objectContaining({ status: TicketStatus.Available })
                    )
                )
            })

            // 5. 티켓을 선점한다
            await step('holds the tickets', async () => {
                const ticketIds = pickIds(tickets.slice(0, 2))

                await fix.httpClient
                    .post(`/booking/showtimes/${showtime.id}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .ok({ success: true })
            })
        })
    })

    describe('GET /booking/showtimes/:id/tickets', () => {
        // 상영시간이 존재하지 않을 때
        describe('when the showtime does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
                await fix.httpClient
                    .get(`/booking/showtimes/${nullObjectId}/tickets`)
                    .notFound({ ...Errors.Booking.ShowtimeNotFound, showtimeId: nullObjectId })
            })
        })
    })
})
