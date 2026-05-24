import { DateUtil, pickIds } from '@mannercode/common'
import { nullObjectId, oid, step } from '@mannercode/testing'
import {
    TicketStatus,
    type MovieDto,
    type ShowtimeDto,
    type TheaterDto,
    type TicketDto
} from 'core'
import { Errors, type AppTestContext } from '../helpers'
import { createAllResources } from './booking.utils'

describe('BookingService', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })
    afterEach(() => fix.teardown())

    describe('고객 예매 흐름', () => {
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

        it('극장, 상영일, 상영 시간, 티켓을 차례로 조회해 티켓을 보유한다', async () => {
            let theater: TheaterDto
            let showdate: Date
            let showtime: ShowtimeDto
            let tickets: TicketDto[]

            await step('1. 영화에 해당하는 극장을 거리순으로 조회한다', async () => {
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

            await step('2. 극장의 상영일 목록을 조회한다', async () => {
                const { body: showdates } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters/${theater.id}/showdates`)
                    .ok([new Date('2999-01-01'), new Date('2999-01-02'), new Date('2999-01-03')])

                showdate = showdates[0]
            })

            await step('3. 선택한 상영일의 상영 시간 목록을 조회한다', async () => {
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

            await step('4. 상영 시간의 가용 티켓을 조회한다', async () => {
                const { body } = await fix.httpClient
                    .get(`/booking/showtimes/${showtime.id}/tickets`)
                    .ok()

                tickets = body

                expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
            })

            await step('5. 선택한 티켓을 보유한다', async () => {
                const ticketIds = pickIds(tickets.slice(0, 2))

                await fix.httpClient
                    .post(`/booking/showtimes/${showtime.id}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .noContent()
            })
        })
    })

    describe('POST /booking/showtimes/:showtimeId/tickets/hold', () => {
        const locations = [{ latitude: 30.0, longitude: 130.0 }]
        const startTimes = [new Date('2999-01-01T12:00')]

        it('티켓이 이미 다른 고객에게 보유되어 있으면 409를 반환한다', async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            const accessToken = resources.accessToken
            const showtimeId = resources.showtimes[0].id
            const ticketIds = pickIds(resources.tickets.slice(0, 2))

            const { holdTickets } = await import('../helpers')
            await holdTickets(fix, { userId: oid(0xff), showtimeId, ticketIds })

            await fix.httpClient
                .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ ticketIds })
                .conflict(Errors.Booking.TicketsAlreadyHeld())
        })
    })

    describe('GET /booking/showtimes/:id/tickets', () => {
        it('상영 시간이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/booking/showtimes/${nullObjectId}/tickets`)
                .notFound(Errors.Booking.ShowtimeNotFound(nullObjectId))
        })
    })

    describe('GET /booking/movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes', () => {
        // `parseShowdate`는 형식이 다르거나 달력에 없는 날짜일 때 거절한다.
        // 두 경우 모두 400으로 응답하는지 확인한다.
        const movieId = nullObjectId
        const theaterId = nullObjectId

        it('YYYYMMDD 형식이 아니면 400을 반환한다', async () => {
            await fix.httpClient
                .get(`/booking/movies/${movieId}/theaters/${theaterId}/showdates/abc/showtimes`)
                .badRequest({
                    code: 'ERR_BOOKING_SHOWDATE_INVALID',
                    message: 'showdate must be in YYYYMMDD format',
                    showdate: 'abc'
                })
        })

        it('형식은 맞지만 실제 달력에 없는 날짜이면 400을 반환한다', async () => {
            // 20240230은 2월 30일이라 달력에 없다.
            // `Date.UTC`는 이 값을 조용히 다음 달로 넘기므로, 컨트롤러가 날짜를 다시 문자열로 바꿔 비교할 때 잘못된 값임을 확인한다.
            await fix.httpClient
                .get(
                    `/booking/movies/${movieId}/theaters/${theaterId}/showdates/20240230/showtimes`
                )
                .badRequest({
                    code: 'ERR_BOOKING_SHOWDATE_INVALID',
                    message: 'showdate must be a valid calendar date',
                    showdate: '20240230'
                })
        })
    })
})
