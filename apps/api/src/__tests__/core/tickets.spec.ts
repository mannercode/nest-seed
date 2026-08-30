import { ensure, pickIds } from '@mannercode/common'
import { nullObjectId, oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { TicketStatus, type TicketDto, type TicketsService } from '#core'
import {
    buildCreateTicketDto,
    createTickets,
    Errors,
    type AppTestContext
} from '../helpers/index.js'

describe('TicketsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let ticketsService: TicketsService

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('../helpers/index.js')
        const { TicketsService } = await import('#core')
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

            it('사가 식별자 목록으로 필터링한다', async () => {
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })

                expect(tickets).toEqual([ticketForSaga])
            })

            it('영화 ID 목록으로 필터링한다', async () => {
                const tickets = await ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([ticketForMovie])
            })

            it('극장 ID 목록으로 필터링한다', async () => {
                const tickets = await ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([ticketForTheater])
            })

            it('상영 시간 ID 목록으로 필터링한다', async () => {
                const tickets = await ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([ticketForShowtime])
            })
        })

        it('필터가 비어 있으면 400을 던진다', async () => {
            const promise = ticketsService.search({})

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongo.FiltersRequired().message,
                status: HttpStatus.BAD_REQUEST
            })
        })
    })

    describe('sellForPurchase', () => {
        it('판매 가능한 티켓들을 구매에 귀속하고 판매 완료 상태로 반환한다', async () => {
            const tickets = await createTickets(fix, [
                { status: TicketStatus.Available },
                { status: TicketStatus.Available },
                { status: TicketStatus.Available }
            ])

            const updatedTickets = await ticketsService.sellForPurchase(pickIds(tickets), oid(0x10))

            expect(updatedTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
        })

        it('일부 티켓이 판매 가능하지 않으면 409로 거절하고 아무것도 바꾸지 않는다', async () => {
            const createdTickets = await createTickets(fix, [
                { status: TicketStatus.Available },
                { status: TicketStatus.Sold }
            ])
            const first = ensure(createdTickets[0])
            const second = ensure(createdTickets[1])

            const promise = ticketsService.sellForPurchase([first.id, second.id], oid(0x10))

            await expect(promise).rejects.toMatchObject({
                response: { code: 'ERR_TICKET_STATUS_TRANSITION_FAILED', ticketIds: [second.id] },
                status: 409
            })

            // 전부-아니면-전무: 충돌이 있으면 나머지 티켓도 전이되지 않아야 한다.
            const after = await ticketsService.getMany([first.id])
            expect(ensure(after[0]).status).toBe(TicketStatus.Available)
        })

        it('존재하지 않는 티켓이 섞이면 전이를 시도하지 않고 404를 던진다', async () => {
            const createdTickets = await createTickets(fix, [{ status: TicketStatus.Available }])
            const ticket = ensure(createdTickets[0])

            const promise = ticketsService.sellForPurchase([ticket.id, nullObjectId], oid(0x10))

            // '없는 티켓'은 상태 충돌(409)이 아니라 누락 id 목록을 담은 404로 분류되어야 한다.
            await expect(promise).rejects.toMatchObject({
                response: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]),
                status: HttpStatus.NOT_FOUND
            })

            const after = await ticketsService.getMany([ticket.id])
            expect(ensure(after[0]).status).toBe(TicketStatus.Available)
        })
    })

    describe('aggregateSales', () => {
        it('상영 시간 ID 목록에 대한 판매 통계를 반환한다', async () => {
            const showtimeId = oid(0x10)
            const totalCount = 50
            const soldCount = 5

            const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))
            const createdTickets = await createTickets(fix, createDtos)

            const soldTickets = createdTickets.slice(0, soldCount)
            await ticketsService.sellForPurchase(pickIds(soldTickets), oid(0x20))

            const ticketSales = await ticketsService.aggregateSales({ showtimeIds: [showtimeId] })

            expect(ticketSales).toEqual([
                {
                    available: totalCount - soldCount,
                    showtimeId,
                    sold: soldCount,
                    total: totalCount
                }
            ])
        })
    })
})
