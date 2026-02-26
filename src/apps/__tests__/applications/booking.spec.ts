import type { MovieDto, ShowtimeDto, TheaterDto, TicketDto } from 'apps/cores'
import { Errors } from 'apps/__tests__/__helpers__'
import { TicketStatus } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, oid, step } from 'testlib'
import type { BookingFixture } from './booking.fixture'
import { createAllResources } from './booking.fixture'

describe('BookingService', () => {
    let fix: BookingFixture

    beforeEach(async () => {
        const { createBookingFixture } = await import('./booking.fixture')
        fix = await createBookingFixture()
    })
    afterEach(() => fix.teardown())

    // 고객이 예매 흐름을 진행할 때
    describe('when a customer goes through the booking flow', () => {
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

        // 선택한 티켓을 보유한다
        it('holds selected tickets', async () => {
            let theater: TheaterDto
            let showdate: Date
            let showtime: ShowtimeDto
            let tickets: TicketDto[]

            await step('1. lists theaters for the movie by distance', async () => {
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

            await step('2. lists show dates for the theater', async () => {
                const { body: showdates } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters/${theater.id}/showdates`)
                    .ok([new Date('2999-01-01'), new Date('2999-01-02'), new Date('2999-01-03')])

                showdate = showdates[0]
            })

            await step('3. lists showtimes for the selected show date', async () => {
                const yymmdd = DateUtil.toYMD(showdate)
                const url = `/booking/movies/${movie.id}/theaters/${theater.id}/showdates/${yymmdd}/showtimes`

                const { body: showtimes } = await fix.httpClient.get(url).ok(
                    expect.arrayContaining(
                        [
                            { movieId: movie.id, startTime: startTimes[0], theaterId: theater.id },
                            { movieId: movie.id, startTime: startTimes[1], theaterId: theater.id }
                        ].map((item) => expect.objectContaining(item))
                    )
                )

                showtime = showtimes[0]
            })

            await step('4. lists available tickets for the showtime', async () => {
                const { body } = await fix.httpClient
                    .get(`/booking/showtimes/${showtime.id}/tickets`)
                    .ok()

                tickets = body

                expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
            })

            await step('5. holds selected tickets', async () => {
                const ticketIds = pickIds(tickets.slice(0, 2))

                await fix.httpClient
                    .post(`/booking/showtimes/${showtime.id}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .ok({ success: true })
            })
        })
    })

    describe('POST /booking/showtimes/:showtimeId/tickets/hold', () => {
        const locations = [{ latitude: 30.0, longitude: 130.0 }]
        const startTimes = [new Date('2999-01-01T12:00')]

        // 티켓이 이미 다른 고객에 의해 보유되었을 때
        describe('when tickets are already held by another customer', () => {
            let accessToken: string
            let showtimeId: string
            let ticketIds: string[]

            beforeEach(async () => {
                const resources = await createAllResources(fix, locations, startTimes)
                accessToken = resources.accessToken
                showtimeId = resources.showtimes[0].id
                ticketIds = pickIds(resources.tickets.slice(0, 2))

                const { holdTickets } = await import('apps/__tests__/__helpers__')
                await holdTickets(fix, { customerId: oid(0xff), showtimeId, ticketIds })
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .conflict(Errors.Booking.TicketsAlreadyHeld())
            })
        })
    })

    describe('GET /booking/showtimes/:id/tickets', () => {
        // 상영 시간이 존재하지 않을 때
        describe('when the showtime does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/booking/showtimes/${nullObjectId}/tickets`)
                    .notFound(Errors.Booking.ShowtimeNotFound(nullObjectId))
            })
        })
    })
})
