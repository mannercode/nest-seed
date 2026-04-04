import { pickIds } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { TicketStatus, TicketDto } from 'cores'
import type { TicketsFixture } from './tickets.fixture'
import { buildCreateTicketDto, createTickets, Errors } from '../__helpers__'

describe('TicketsService', () => {
    let fix: TicketsFixture

    beforeEach(async () => {
        const { createTicketsFixture } = await import('./tickets.fixture')
        fix = await createTicketsFixture()
    })
    afterEach(() => fix.teardown())

    describe('createMany', () => {
        // 티켓을 생성한다
        it('creates tickets', async () => {
            const createDtos = [buildCreateTicketDto({ sagaId: oid(0x1) })]

            const { success } = await fix.ticketsService.createMany(createDtos)

            expect(success).toBe(true)
        })
    })

    describe('search', () => {
        // 필터가 제공될 때
        describe('when the filter is provided', () => {
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

                ticketForSaga = createdTickets[0]
                ticketForMovie = createdTickets[1]
                ticketForTheater = createdTickets[2]
                ticketForShowtime = createdTickets[3]
            })

            // sagaIds로 필터링된 티켓을 반환한다
            it('returns tickets filtered by sagaIds', async () => {
                const tickets = await fix.ticketsService.search({ sagaIds: [sagaId] })

                expect(tickets).toEqual([ticketForSaga])
            })

            // movieIds로 필터링된 티켓을 반환한다
            it('returns tickets filtered by movieIds', async () => {
                const tickets = await fix.ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([ticketForMovie])
            })

            // theaterIds로 필터링된 티켓을 반환한다
            it('returns tickets filtered by theaterIds', async () => {
                const tickets = await fix.ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([ticketForTheater])
            })

            // showtimeIds로 필터링된 티켓을 반환한다
            it('returns tickets filtered by showtimeIds', async () => {
                const tickets = await fix.ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([ticketForShowtime])
            })
        })

        // 필터가 비어 있을 때
        describe('when the filter is empty', () => {
            // 400 Bad Request를 던진다
            it('throws 400 Bad Request', async () => {
                const promise = fix.ticketsService.search({})

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongoose.FiltersRequired().message,
                    status: HttpStatus.BAD_REQUEST
                })
            })
        })
    })

    describe('updateStatusMany', () => {
        // 티켓이 존재할 때
        describe('when the tickets exist', () => {
            let tickets: TicketDto[]

            beforeEach(async () => {
                tickets = await createTickets(fix, [
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available }
                ])
            })

            // 수정된 티켓을 반환한다
            it('returns the updated tickets', async () => {
                const updatedTickets = await fix.ticketsService.updateStatusMany(
                    pickIds(tickets),
                    TicketStatus.Sold
                )

                expect(updatedTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
            })
        })
    })

    describe('aggregateSales', () => {
        // showtimeIds가 제공될 때
        describe('when the showtimeIds are provided', () => {
            const showtimeId = oid(0x10)
            const totalCount = 50
            const soldCount = 5

            beforeEach(async () => {
                const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))
                const createdTickets = await createTickets(fix, createDtos)

                const soldTickets = createdTickets.slice(0, soldCount)
                await fix.ticketsService.updateStatusMany(pickIds(soldTickets), TicketStatus.Sold)
            })

            // showtimeIds에 대한 판매 통계를 반환한다
            it('returns sales stats for the showtimeIds', async () => {
                const ticketSales = await fix.ticketsService.aggregateSales({
                    showtimeIds: [showtimeId]
                })

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
})
