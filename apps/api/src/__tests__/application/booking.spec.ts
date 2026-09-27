import { BookingShowtimeSchema } from '#application'
import { DateUtil, ensure, pickIds, PlainDateFromInputSchema } from '@mannercode/common'
import { instant, nullObjectId, oid, plainDate, step } from '@mannercode/testing'
import {
    TicketStatus,
    type MovieDto,
    type ShowtimeDto,
    type TheaterDto,
    type TicketDto,
    type UserDto,
    TicketHoldingService,
    TicketsService,
    TheaterSchema,
    TicketSchema
} from '#core'
import { Errors, type AppTestContext, createAppTestContext, holdTickets } from '../helpers/index.js'
import { createAllResources } from './booking.utils.js'
import { AppConfigService } from '#config'

describe('BookingService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('고객 예매 흐름', () => {
        let movie: MovieDto
        let accessToken: string
        let createdTickets: TicketDto[]
        let user: UserDto

        const locations = [
            { latitude: 30.0, longitude: 130.0 },
            { latitude: 31.0, longitude: 131.0 },
            { latitude: 32.0, longitude: 132.0 },
            { latitude: 33.0, longitude: 133.0 },
            { latitude: 34.0, longitude: 134.0 }
        ]

        const startTimes = [
            instant('2999-01-01T12:00Z'),
            instant('2999-01-01T14:00Z'),
            instant('2999-01-03T12:00Z'),
            instant('2999-01-02T14:00Z')
        ]

        beforeEach(async () => {
            const resources = await createAllResources(fix, locations, startTimes)
            movie = resources.movie
            accessToken = resources.accessToken
            createdTickets = resources.tickets
            user = resources.user
        })

        describe('선택한 날짜에 상영이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                const theaterId = ensure(createdTickets[0]).theaterId
                request = fix.httpClient.get(
                    `/booking/movies/${movie.id}/theaters/${theaterId}/showdates/29990201/showtimes`
                )
            })
            it('상영 목록을 조회하면 빈 목록을 반환한다', async () => {
                await request.ok({ schema: BookingShowtimeSchema.array(), expected: [] })
            })
        })

        describe('티켓 집계가 빈 결과를 반환하면', () => {
            let theaterId: string
            beforeEach(() => {
                theaterId = ensure(createdTickets[0]).theaterId
                vi.spyOn(fix.module.get(TicketsService), 'aggregateSales').mockResolvedValueOnce([])
            })
            it('상영 목록 조회 요청에 500을 반환한다', async () => {
                await fix.httpClient
                    .get(
                        `/booking/movies/${movie.id}/theaters/${theaterId}/showdates/29990101/showtimes`
                    )
                    .send(500, {
                        expected: {
                            statusCode: 500,
                            message: 'Internal server error',
                            error: 'Internal Server Error'
                        }
                    })
            })
        })

        it('극장·상영일·상영 시간·티켓을 차례로 조회하고 선택한 티켓을 선점한다', async () => {
            let theater: TheaterDto
            let showdate: Temporal.PlainDate
            let showtime: ShowtimeDto
            let tickets: TicketDto[]

            await step('1. 영화에 해당하는 극장을 거리순으로 조회한다', async () => {
                const latLong = '31.9,131.9'
                const { body: theaters } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters?latLong=${latLong}`)
                    .ok({
                        schema: TheaterSchema.array(),
                        expected: [
                            { location: locations[2] }, // distance = 0.1
                            { location: locations[1] }, // distance = 0.9
                            { location: locations[3] }, // distance = 1.1
                            { location: locations[0] }, // distance = 1.9
                            { location: locations[4] } // distance = 2.1
                        ].map((item) => expect.objectContaining(item))
                    })

                theater = ensure(theaters[0])
            })

            await step('2. 극장의 상영일 목록을 조회한다', async () => {
                const { body: showdates } = await fix.httpClient
                    .get(`/booking/movies/${movie.id}/theaters/${theater.id}/showdates`)
                    .ok({
                        schema: PlainDateFromInputSchema.array(),
                        expected: [
                            plainDate('2999-01-01'),
                            plainDate('2999-01-02'),
                            plainDate('2999-01-03')
                        ]
                    })

                showdate = ensure(showdates[0])
            })

            await step('3. 선택한 상영일의 상영 시간 목록을 조회한다', async () => {
                const yymmdd = DateUtil.toYMD(showdate)
                const url = `/booking/movies/${movie.id}/theaters/${theater.id}/showdates/${yymmdd}/showtimes`

                const { body: showtimes } = await fix.httpClient.get(url).ok({
                    schema: BookingShowtimeSchema.array(),
                    expected: [
                        { movieId: movie.id, startTime: startTimes[0], theaterId: theater.id },
                        { movieId: movie.id, startTime: startTimes[1], theaterId: theater.id }
                    ].map((item) =>
                        expect.objectContaining({
                            ...item,
                            ticketSales: { available: 8, sold: 0, total: 8 }
                        })
                    )
                })

                showtime = ensure(showtimes[0])
            })

            await step('4. 상영 시간의 티켓을 조회해 판매되지 않은 상태를 확인한다', async () => {
                const expectedTickets = createdTickets.filter(
                    (ticket) => ticket.showtimeId === showtime.id
                )
                const { body } = await fix.httpClient
                    .get(`/booking/showtimes/${showtime.id}/tickets`)
                    .ok({ schema: TicketSchema.array(), expected: expectedTickets })

                tickets = body

                expect(tickets).toHaveLength(8)
                expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
            })

            await step('5. 선택한 티켓을 선점한다', async () => {
                const ticketIds = pickIds(tickets.slice(0, 2))

                await fix.httpClient
                    .post(`/booking/showtimes/${showtime.id}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .noContent()

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
        const startTimes = [instant('2999-01-01T12:00Z')]

        describe('인증 정보가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/booking/showtimes/${nullObjectId}/tickets/hold`)
                    .body({ ticketIds: [nullObjectId] })
            })
            it('티켓 선점을 요청하면 401을 반환한다', async () => {
                await request.unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        describe('선점되지 않은 티켓이 존재하면', () => {
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

            it('선점 요청에 204를 반환하고 선점 목록에 티켓을 추가한다', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .noContent()

                const ticketHoldingService = fix.module.get(TicketHoldingService)
                const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                    showtimeId,
                    userId
                )
                expect(heldTicketIds.sort()).toEqual([...ticketIds].sort())
            })

            describe('요청한 티켓 ID에 존재하지 않는 ID가 섞여 있으면', () => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    request = fix.httpClient
                        .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ ticketIds: [...ticketIds, nullObjectId] })
                })
                it('티켓 선점을 요청하면 404를 반환한다', async () => {
                    await request.notFound({
                        expected: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId])
                    })
                })
            })

            describe('요청한 티켓 수가 선점 한도를 넘으면', () => {
                let request: typeof fix.httpClient
                let max: number
                beforeEach(() => {
                    max = fix.module.get(AppConfigService).ticket.maxPerPurchase
                    const ticketIds = Array.from({ length: max + 1 }, (_, i) => oid(0x100 + i))
                    request = fix.httpClient
                        .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ ticketIds })
                })
                it('티켓 선점을 요청하면 400을 반환한다', async () => {
                    await request.badRequest({ expected: Errors.Booking.HoldLimitExceeded(max) })
                })
            })
        })

        describe('다른 사용자 ID로 선점된 티켓이 존재하면', () => {
            let accessToken: string
            let showtimeId: string
            let ticketIds: string[]
            beforeEach(async () => {
                const resources = await createAllResources(fix, locations, startTimes)
                accessToken = resources.accessToken
                showtimeId = ensure(resources.showtimes[0]).id
                ticketIds = pickIds(resources.tickets.slice(0, 2))

                await holdTickets(fix, { userId: oid(0xff), showtimeId, ticketIds })
            })
            it('해당 티켓의 선점 요청에 409를 반환한다', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ ticketIds })
                    .conflict({ expected: Errors.Booking.TicketsAlreadyHeld() })
            })
        })

        describe('서로 다른 상영의 티켓이 존재하면', () => {
            let resources: Awaited<ReturnType<typeof createAllResources>>
            let showtimeId: string
            let ownTicket: TicketDto
            let otherTicket: TicketDto
            beforeEach(async () => {
                resources = await createAllResources(fix, locations, [
                    instant('2999-01-01T12:00Z'),
                    instant('2999-01-01T15:00Z')
                ])
                showtimeId = ensure(resources.showtimes[0]).id
                ownTicket = ensure(resources.tickets.find((t) => t.showtimeId === showtimeId))
                otherTicket = ensure(resources.tickets.find((t) => t.showtimeId !== showtimeId))
            })
            it('두 상영의 티켓을 함께 선점하는 요청에 400을 반환한다', async () => {
                await fix.httpClient
                    .post(`/booking/showtimes/${showtimeId}/tickets/hold`)
                    .headers({ Authorization: `Bearer ${resources.accessToken}` })
                    .body({ ticketIds: [ownTicket.id, otherTicket.id] })
                    .badRequest({
                        expected: Errors.Booking.TicketsNotInShowtime([otherTicket.id], showtimeId)
                    })
            })
        })
    })

    describe('GET /booking/showtimes/:id/tickets', () => {
        describe('ID에 해당하는 상영이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get(`/booking/showtimes/${nullObjectId}/tickets`)
            })
            it('티켓 목록을 조회하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Booking.ShowtimeNotFound(nullObjectId) })
            })
        })
    })

    describe('GET /booking/movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes', () => {
        // showdate 검증은 `ParseShowdatePipe`가 수행한다.
        const movieId = nullObjectId
        const theaterId = nullObjectId

        describe('상영일이 YYYYMMDD 형식이 아니면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get(
                    `/booking/movies/${movieId}/theaters/${theaterId}/showdates/abc/showtimes`
                )
            })
            it('상영 목록을 조회하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: {
                        code: 'ERR_BOOKING_SHOWDATE_INVALID',
                        message: 'showdate must be in YYYYMMDD format',
                        showdate: 'abc'
                    }
                })
            })
        })

        describe('상영일의 형식은 맞지만 실제 달력에 없는 날짜이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get(
                    `/booking/movies/${movieId}/theaters/${theaterId}/showdates/20240230/showtimes`
                )
            })
            it('상영 목록을 조회하면 400을 반환한다', async () => {
                // Temporal은 잘못된 달력 날짜를 조용히 보정하지 않아야 한다.
                await request.badRequest({
                    expected: {
                        code: 'ERR_BOOKING_SHOWDATE_INVALID',
                        message: 'showdate must be a valid calendar date',
                        showdate: '20240230'
                    }
                })
            })
        })
    })
})
