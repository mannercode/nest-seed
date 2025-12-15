import { HttpStatus } from '@nestjs/common'
import { TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { oid } from 'testlib'
import { buildCreateTicketDto, createTickets, Errors } from '../__helpers__'
import type { TicketsFixture } from './tickets.fixture'

describe('TicketsService', () => {
    let fix: TicketsFixture

    beforeEach(async () => {
        const { createTicketsFixture } = await import('./tickets.fixture')
        fix = await createTicketsFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createMany', () => {
        it('creates tickets', async () => {
            const createDtos = [buildCreateTicketDto({ sagaId: oid(0x1) })]

            const { success } = await fix.ticketsService.createMany(createDtos)

            expect(success).toBe(true)
        })
    })

    describe('search', () => {
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
                ;[ticketForSaga, ticketForMovie, ticketForTheater, ticketForShowtime] =
                    await createTickets(fix, [
                        { sagaId },
                        { movieId },
                        { theaterId },
                        { showtimeId }
                    ])
            })

            it('returns tickets filtered by sagaIds', async () => {
                const tickets = await fix.ticketsService.search({ sagaIds: [sagaId] })

                expect(tickets).toEqual([ticketForSaga])
            })

            it('returns tickets filtered by movieIds', async () => {
                const tickets = await fix.ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([ticketForMovie])
            })

            it('returns tickets filtered by theaterIds', async () => {
                const tickets = await fix.ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([ticketForTheater])
            })

            it('returns tickets filtered by showtimeIds', async () => {
                const tickets = await fix.ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([ticketForShowtime])
            })
        })

        it('throws 400 Bad Request for an empty filter', async () => {
            const promise = fix.ticketsService.search({})

            await expect(promise).rejects.toMatchObject({
                status: HttpStatus.BAD_REQUEST,
                message: Errors.Mongoose.FiltersRequired.message
            })
        })
    })

    describe('updateStatusMany', () => {
        describe('when the tickets exist', () => {
            let tickets: TicketDto[]

            beforeEach(async () => {
                tickets = await createTickets(fix, [
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available },
                    { status: TicketStatus.Available }
                ])
            })

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

            it('returns sales stats for the showtimeIds', async () => {
                const ticketSales = await fix.ticketsService.aggregateSales({
                    showtimeIds: [showtimeId]
                })

                expect(ticketSales).toEqual([
                    {
                        showtimeId,
                        total: totalCount,
                        sold: soldCount,
                        available: totalCount - soldCount
                    }
                ])
            })
        })
    })
})
