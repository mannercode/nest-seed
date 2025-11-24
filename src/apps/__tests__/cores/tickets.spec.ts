import { TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { oid } from 'testlib'
import { buildCreateTicketDto, createTickets } from '../__helpers__'
import type { Fixture } from './tickets.fixture'

describe('TicketsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./tickets.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createTickets', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 티켓을 생성하고 결과를 반환한다
            it('creates and returns tickets', async () => {
                const createDtos = [buildCreateTicketDto({ transactionId: oid(0x1) })]

                const { success } = await fix.ticketsService.createTickets(createDtos)

                expect(success).toBe(true)
            })
        })
    })

    describe('searchTickets', () => {
        const transactionId = oid(0x1)
        const movieId = oid(0x2)
        const theaterId = oid(0x3)
        const showtimeId = oid(0x4)
        let createdTickets: TicketDto[]

        beforeEach(async () => {
            const createDtos = [{ transactionId }, { movieId }, { theaterId }, { showtimeId }]

            createdTickets = await createTickets(fix, createDtos)
        })

        // `transactionIds`가 제공된 경우
        describe('when `transactionIds` are provided', () => {
            // 지정한 transactionIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the transactionIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({
                    transactionIds: [transactionId]
                })

                expect(tickets).toEqual([createdTickets[0]])
            })
        })

        // `movieIds`가 제공된 경우
        describe('when `movieIds` are provided', () => {
            // 지정한 movieIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the movieIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ movieIds: [movieId] })

                expect(tickets).toEqual([createdTickets[1]])
            })
        })

        // `theaterIds`가 제공된 경우
        describe('when `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the theaterIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ theaterIds: [theaterId] })

                expect(tickets).toEqual([createdTickets[2]])
            })
        })

        // `showtimeIds`가 제공된 경우
        describe('when `showtimeIds` are provided', () => {
            // 지정한 showtimeIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the showtimeIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({
                    showtimeIds: [showtimeId]
                })

                expect(tickets).toEqual([createdTickets[3]])
            })
        })

        // 필터가 비어있는 경우
        describe('when filter is empty', () => {
            // 400 status를 던진다
            it('throws 400 status', async () => {
                const promise = fix.ticketsService.searchTickets({})

                await expect(promise).rejects.toMatchObject({
                    status: 400,
                    message: 'At least one filter condition must be provided'
                })
            })
        })
    })

    describe('updateTicketsStatus', () => {
        let createdTickets: TicketDto[]

        beforeEach(async () => {
            createdTickets = await createTickets(fix, [
                { status: TicketStatus.Available },
                { status: TicketStatus.Available },
                { status: TicketStatus.Available }
            ])
        })

        // 티켓이 존재하는 경우
        describe('when tickets exist', () => {
            // 티켓의 상태를 변경하고 변경된 티켓을 반환한다
            it('updates ticket status and returns the tickets', async () => {
                const updatedTickets = await fix.ticketsService.updateTicketsStatus(
                    pickIds(createdTickets),
                    TicketStatus.Sold
                )

                expect(updatedTickets.map((ticket) => ticket.status)).toEqual(
                    Array(updatedTickets.length).fill(TicketStatus.Sold)
                )
            })
        })
    })

    describe('aggregateTicketSales', () => {
        // `showtimeIds`가 제공된 경우
        describe('when `showtimeIds` are provided', () => {
            const showtimeId = oid(0x10)
            const totalCount = 50
            const soldCount = 5

            beforeEach(async () => {
                const createDtos = Array.from({ length: totalCount }, () => ({ showtimeId }))

                const createdTickets = await createTickets(fix, createDtos)

                const soldTickets = createdTickets.slice(0, soldCount)

                await fix.ticketsService.updateTicketsStatus(
                    pickIds(soldTickets),
                    TicketStatus.Sold
                )
            })

            // 지정한 showtimeIds에 대한 판매 통계를 반환한다
            it('returns sales stats for the showtimeIds', async () => {
                const ticketSales = await fix.ticketsService.aggregateTicketSales({
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
