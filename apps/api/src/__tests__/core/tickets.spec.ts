import { ensure, pickIds } from '@mannercode/common'
import { nullObjectId, oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { TicketStatus, type TicketDto, TicketsService } from '#core'
import { TicketsRepository } from '../../services/core/tickets/tickets.repository.js'
import {
    buildCreateTicketDto,
    createTickets,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

describe('TicketsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let ticketsService: TicketsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        ticketsService = fix.module.get(TicketsService)
    })
    afterEach(() => teardown?.())

    describe('createMany', () => {
        it('생성된 티켓 수를 반환한다', async () => {
            const createDtos = [buildCreateTicketDto({ sagaId: oid(0x1) })]

            const { count } = await ticketsService.createMany(createDtos)

            expect(count).toBe(createDtos.length)
        })

        it('티켓을 DB에 저장한다', async () => {
            const sagaId = oid(0x1)
            const createDto = buildCreateTicketDto({
                sagaId,
                movieId: oid(0x2),
                theaterId: oid(0x3),
                showtimeId: oid(0x4),
                seat: { block: '2b', row: '2r', seatNumber: 2 },
                status: TicketStatus.Available
            })

            await ticketsService.createMany([createDto])

            const tickets = await ticketsService.search({ sagaIds: [sagaId] })
            expect(tickets).toEqual([
                {
                    id: expect.any(String),
                    movieId: createDto.movieId,
                    theaterId: createDto.theaterId,
                    showtimeId: createDto.showtimeId,
                    seat: createDto.seat,
                    status: createDto.status
                }
            ])
        })
    })

    describe('search', () => {
        describe('id 필터링', () => {
            const sagaId = oid(0x1)
            const movieId = oid(0x2)
            const theaterId = oid(0x3)
            const showtimeId = oid(0x4)
            let ticketForSaga: TicketDto
            let ticketForMovie: TicketDto
            let ticketForTheater: TicketDto
            let ticketForShowtime: TicketDto

            beforeEach(async () => {
                const createdTickets = await createTickets(fix, [
                    { sagaId },
                    { movieId },
                    { theaterId },
                    { showtimeId }
                ])

                ticketForSaga = ensure(createdTickets[0])
                ticketForMovie = ensure(createdTickets[1])
                ticketForTheater = ensure(createdTickets[2])
                ticketForShowtime = ensure(createdTickets[3])
            })

            describe('사가 식별자 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof ticketsService.search>[0]
                beforeEach(() => {
                    query = { sagaIds: [sagaId] }
                })
                it('검색하면 해당 ID에 속한 티켓만 반환한다', async () => {
                    const tickets = await ticketsService.search(query)

                    expect(tickets).toEqual([ticketForSaga])
                })
            })

            describe('영화 ID 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof ticketsService.search>[0]
                beforeEach(() => {
                    query = { movieIds: [movieId] }
                })
                it('검색하면 해당 ID에 속한 티켓만 반환한다', async () => {
                    const tickets = await ticketsService.search(query)

                    expect(tickets).toEqual([ticketForMovie])
                })
            })

            describe('극장 ID 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof ticketsService.search>[0]
                beforeEach(() => {
                    query = { theaterIds: [theaterId] }
                })
                it('검색하면 해당 ID에 속한 티켓만 반환한다', async () => {
                    const tickets = await ticketsService.search(query)

                    expect(tickets).toEqual([ticketForTheater])
                })
            })

            describe('상영 시간 ID 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof ticketsService.search>[0]
                beforeEach(() => {
                    query = { showtimeIds: [showtimeId] }
                })
                it('검색하면 해당 ID에 속한 티켓만 반환한다', async () => {
                    const tickets = await ticketsService.search(query)

                    expect(tickets).toEqual([ticketForShowtime])
                })
            })
        })

        describe('검색 조건이 비어 있으면', () => {
            let query: Parameters<typeof ticketsService.search>[0]
            beforeEach(() => {
                query = {}
            })
            it('티켓을 검색하면 400 예외를 던진다', async () => {
                const promise = ticketsService.search(query)

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongo.FiltersRequired().message,
                    status: HttpStatus.BAD_REQUEST
                })
            })
        })
    })

    describe('sellForPurchase', () => {
        describe('판매 가능한 티켓이 있을 때', () => {
            let tickets: TicketDto[]
            const purchaseRecordId = oid(0x10)

            beforeEach(async () => {
                tickets = await createTickets(fix, [
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available }
                ])
            })

            it('요청한 티켓을 해당 구매에 연결하고 판매 완료 상태로 반환한다', async () => {
                const updatedTickets = await ticketsService.sellForPurchase(
                    pickIds(tickets),
                    purchaseRecordId
                )

                expect(updatedTickets).toHaveLength(tickets.length)
                expect(updatedTickets).toEqual(
                    expect.arrayContaining(
                        tickets.map((ticket) => ({ ...ticket, status: TicketStatus.Sold }))
                    )
                )

                // 구매 귀속은 공개 TicketDto에 없는 저장 계약이다.
                const stored = await fix.module
                    .get(TicketsRepository)
                    .getMany({ ids: pickIds(tickets) })
                expect(stored).toHaveLength(tickets.length)
                expect(stored).toEqual(
                    expect.arrayContaining(
                        tickets.map(({ id }) =>
                            expect.objectContaining({
                                id,
                                purchaseRecordId,
                                status: TicketStatus.Sold
                            })
                        )
                    )
                )
            })

            describe('판매할 티켓 ID에 존재하지 않는 ID가 섞여 있으면', () => {
                let ticket: TicketDto
                let ticketIds: string[]
                beforeEach(() => {
                    ticket = ensure(tickets[0])
                    ticketIds = [ticket.id, nullObjectId]
                })
                it('판매를 요청하면 404 예외를 던지고 기존 티켓의 상태를 유지한다', async () => {
                    const promise = ticketsService.sellForPurchase(ticketIds, oid(0x10))

                    // '없는 티켓'은 상태 충돌(409)이 아니라 누락 id 목록을 담은 404로 분류되어야 한다.
                    await expect(promise).rejects.toMatchObject({
                        response: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]),
                        status: HttpStatus.NOT_FOUND
                    })

                    const after = await ticketsService.getMany([ticket.id])
                    expect(ensure(after[0]).status).toBe(TicketStatus.Available)
                })
            })
        })

        describe('판매 가능한 티켓과 이미 판매된 티켓이 있으면', () => {
            let first: TicketDto
            let second: TicketDto
            beforeEach(async () => {
                const createdTickets = await createTickets(fix, [
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Sold }
                ])
                first = ensure(createdTickets[0])
                second = ensure(createdTickets[1])
            })
            it('함께 판매를 요청하면 409 예외를 던지고 판매 가능한 티켓의 상태를 유지한다', async () => {
                const promise = ticketsService.sellForPurchase([first.id, second.id], oid(0x10))

                await expect(promise).rejects.toMatchObject({
                    response: {
                        code: 'ERR_TICKET_STATUS_TRANSITION_FAILED',
                        ticketIds: [second.id]
                    },
                    status: 409
                })

                // 전부-아니면-전무: 충돌이 있으면 나머지 티켓도 전이되지 않아야 한다.
                const after = await ticketsService.getMany([first.id])
                expect(ensure(after[0]).status).toBe(TicketStatus.Available)
            })
        })
    })

    describe('aggregateSales', () => {
        describe('한 상영의 티켓 50장 중 5장이 판매되었으면', () => {
            let showtimeId: string
            let emptyShowtimeId: string
            let totalCount: number
            let soldCount: number
            beforeEach(async () => {
                showtimeId = oid(0x10)
                emptyShowtimeId = oid(0x11)
                totalCount = 50
                soldCount = 5

                const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))
                const createdTickets = await createTickets(fix, createDtos)

                const soldTickets = createdTickets.slice(0, soldCount)
                await ticketsService.sellForPurchase(pickIds(soldTickets), oid(0x20))
            })
            it('판매 집계와 티켓이 없는 상영의 0건 집계를 함께 반환한다', async () => {
                const ticketSales = await ticketsService.aggregateSales({
                    showtimeIds: [showtimeId, emptyShowtimeId]
                })

                expect(ticketSales).toEqual([
                    {
                        available: totalCount - soldCount,
                        showtimeId,
                        sold: soldCount,
                        total: totalCount
                    },
                    { available: 0, showtimeId: emptyShowtimeId, sold: 0, total: 0 }
                ])
            })
        })
    })
})
