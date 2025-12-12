import { TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { oid } from 'testlib'
import { buildCreateTicketDto, createTickets, Errors } from '../__helpers__'
import type { TicketsFixture } from './tickets.fixture'

describe('TicketsService', () => {
    let fixture: TicketsFixture

    beforeEach(async () => {
        const { createTicketsFixture } = await import('./tickets.fixture')
        fixture = await createTicketsFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('createMany', () => {
        describe('when the payload is valid', () => {
            it('creates and returns tickets', async () => {
                const createDtos = [buildCreateTicketDto({ sagaId: oid(0x1) })]

                const { success } = await fixture.ticketsService.createMany(createDtos)

                expect(success).toBe(true)
            })
        })
    })

    describe('search', () => {
        const sagaId = oid(0x1)
        const movieId = oid(0x2)
        const theaterId = oid(0x3)
        const showtimeId = oid(0x4)
        let ticketForSaga: TicketDto
        let ticketForMovie: TicketDto
        let ticketForTheater: TicketDto
        let ticketForShowtime: TicketDto

        beforeEach(async () => {
            ;[ticketForSaga] = await createTickets(fixture, [{ sagaId }])
            ;[ticketForMovie] = await createTickets(fixture, [{ movieId }])
            ;[ticketForTheater] = await createTickets(fixture, [{ theaterId }])
            ;[ticketForShowtime] = await createTickets(fixture, [{ showtimeId }])
        })

        describe('when the `sagaIds` are provided', () => {
            it('returns tickets for the sagaIds', async () => {
                const tickets = await fixture.ticketsService.search({ sagaIds: [sagaId] })

                expect(tickets).toEqual([ticketForSaga])
            })
        })

        describe('when the `movieIds` are provided', () => {
            it('returns tickets for the movieIds', async () => {
                const tickets = await fixture.ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([ticketForMovie])
            })
        })

        describe('when the `theaterIds` are provided', () => {
            it('returns tickets for the theaterIds', async () => {
                const tickets = await fixture.ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([ticketForTheater])
            })
        })

        describe('when the `showtimeIds` are provided', () => {
            it('returns tickets for the showtimeIds', async () => {
                const tickets = await fixture.ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([ticketForShowtime])
            })
        })

        describe('when the filter is empty', () => {
            it('throws 400 status', async () => {
                const promise = fixture.ticketsService.search({})

                await expect(promise).rejects.toMatchObject({
                    status: 400,
                    message: Errors.Mongoose.FiltersRequired.message
                })
            })
        })
    })

    describe('updateStatusMany', () => {
        let createdTickets: TicketDto[]

        beforeEach(async () => {
            createdTickets = await createTickets(fixture, [
                { status: TicketStatus.Available },
                { status: TicketStatus.Available },
                { status: TicketStatus.Available }
            ])
        })

        describe('when the tickets exist', () => {
            it('updates ticket status and returns the tickets', async () => {
                const updatedTickets = await fixture.ticketsService.updateStatusMany(
                    pickIds(createdTickets),
                    TicketStatus.Sold
                )

                expect(updatedTickets.map((ticket) => ticket.status)).toEqual(
                    Array(updatedTickets.length).fill(TicketStatus.Sold)
                )
            })
        })
    })

    describe('aggregateSales', () => {
        describe('when the `showtimeIds` are provided', () => {
            const showtimeId = oid(0x10)
            const totalCount = 50
            const soldCount = 5

            beforeEach(async () => {
                const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))

                const createdTickets = await createTickets(fixture, createDtos)

                const soldTickets = createdTickets.slice(0, soldCount)

                await fixture.ticketsService.updateStatusMany(
                    pickIds(soldTickets),
                    TicketStatus.Sold
                )
            })

            it('returns sales stats for the showtimeIds', async () => {
                const ticketSales = await fixture.ticketsService.aggregateSales({
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
