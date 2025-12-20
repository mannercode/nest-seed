import { TicketStatus } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, step } from 'testlib'
import { Errors } from '../__helpers__'
import { createAllResources, type BookingFixture } from './booking.fixture'
import type { MovieDto, ShowtimeDto, TheaterDto, TicketDto } from 'apps/cores'

describe('BookingService', () => {
    let fix: BookingFixture

    beforeEach(async () => {
        const { createBookingFixture } = await import('./booking.fixture')
        fix = await createBookingFixture()
    })
    afterEach(() => fix.teardown())

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
                            { movieId: movie.id, theaterId: theater.id, startTime: startTimes[0] },
                            { movieId: movie.id, theaterId: theater.id, startTime: startTimes[1] }
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

    describe('GET /booking/showtimes/:id/tickets', () => {
        describe('when the showtime does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/booking/showtimes/${nullObjectId}/tickets`)
                    .notFound({ ...Errors.Booking.ShowtimeNotFound, showtimeId: nullObjectId })
            })
        })
    })
})
