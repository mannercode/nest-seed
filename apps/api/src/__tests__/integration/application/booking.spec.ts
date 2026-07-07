import { DateUtil, ensure, pickIds } from '@mannercode/common'
import { nullObjectId, oid, step } from '@mannercode/testing'
import {
    TicketStatus,
    type MovieDto,
    type ShowtimeDto,
    type TheaterDto,
    type TicketDto,
    type UserDto
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
        let user: UserDto

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
            user = resources.user
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

                const { TicketHoldingService } = await import('core')
                const ticketHoldingService = fix.module.get(TicketHoldingService)
                const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                    showtime.id,
                    user.id
                )
                expect(heldTicketIds.sort()).toEqual([...ticketIds].sort())
            })
        })
    })

    describe('POST /booking/showtimes/:showtimeId/tickets/hold', () => {
        const locations = [{ latitude: 30.0, longitude: 130.0 }]
        const startTimes = [new Date('2999-01-01T12:00')]

        describe('가용 티켓을 선택했을 때', () => {
            let accessToken: string
            let userId: string
            let showtimeId: string
            let ticketIds: string[]

            beforeEach(async () => {
                const resources = await createAllResources(fix, locations, startTimes)
                accessToken = resources.accessToken
                userId = resources.user.id
                showtimeId = ensure(resources.showtimes[0]).id
                ticketIds = pickIds(resources.tickets.slice(0, 2))
            })

            it('204를 반환한다', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .noContent()
            })

            it('보유 상태가 반영된다', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .noContent()

                const { TicketHoldingService } = await import('core')
                const ticketHoldingService = fix.module.get(TicketHoldingService)
                const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                    showtimeId,
                    userId
                )
                expect(heldTicketIds.sort()).toEqual([...ticketIds].sort())
            })
        })

        it('티켓이 이미 다른 고객에게 보유되어 있으면 409를 반환한다', async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            const accessToken = resources.accessToken
            const showtimeId = ensure(resources.showtimes[0]).id
            const ticketIds = pickIds(resources.tickets.slice(0, 2))

            const { holdTickets } = await import('../helpers')
            await holdTickets(fix, { userId: oid(0xff), showtimeId, ticketIds })

            await fix.httpClient
                .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ ticketIds })
                .conflict(Errors.Booking.TicketsAlreadyHeld())
        })

        it('존재하지 않는 티켓이 섞여 있으면 404를 반환한다', async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            const showtimeId = ensure(resources.showtimes[0]).id
            const ticketIds = [...pickIds(resources.tickets.slice(0, 2)), nullObjectId]

            await fix.httpClient
                .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                .headers({ Authorization: `Bearer ${resources.accessToken}` })
                .body({ ticketIds })
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
        })

        it('다른 상영의 티켓이 섞여 있으면 400을 반환한다', async () => {
            const resources = await createAllResources(fix, locations, [
                new Date('2999-01-01T12:00'),
                new Date('2999-01-01T15:00')
            ])
            const showtimeId = ensure(resources.showtimes[0]).id
            const ownTicket = ensure(resources.tickets.find((t) => t.showtimeId === showtimeId))
            const otherTicket = ensure(resources.tickets.find((t) => t.showtimeId !== showtimeId))

            await fix.httpClient
                .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                .headers({ Authorization: `Bearer ${resources.accessToken}` })
                .body({ ticketIds: [ownTicket.id, otherTicket.id] })
                .badRequest(Errors.Booking.TicketsNotInShowtime([otherTicket.id], showtimeId))
        })

        it('한 번에 보유할 수 있는 수량을 넘으면 400을 반환한다', async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            const showtimeId = ensure(resources.showtimes[0]).id

            const { AppConfigService } = await import('config')
            const max = fix.module.get(AppConfigService).ticket.maxPerPurchase
            const ticketIds = Array.from({ length: max + 1 }, (_, i) => oid(0x100 + i))

            await fix.httpClient
                .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                .headers({ Authorization: `Bearer ${resources.accessToken}` })
                .body({ ticketIds })
                .badRequest(Errors.Booking.HoldLimitExceeded(max))
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
        // showdate 검증은 `ParseShowdatePipe`가 수행한다.
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
            // `Date.UTC`는 이 값을 조용히 다음 달로 넘기므로, 파이프가 만든 Date를 다시 분해해 원본과 비교할 때 잘못된 값임을 확인한다.
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
