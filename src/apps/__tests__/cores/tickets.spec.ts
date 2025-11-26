import { TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { oid } from 'testlib'
import { buildCreateTicketDto, createTickets } from '../__helpers__'
import type { Fixture } from './tickets.fixture'

describe('TicketsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./tickets.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('createMany', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 티켓을 생성하고 결과를 반환한다
            it('creates and returns tickets', async () => {
                const createDtos = [buildCreateTicketDto({ transactionId: oid(0x1) })]

                const { success } = await fixture.ticketsService.createMany(createDtos)

                expect(success).toBe(true)
            })
        })
    })

    describe('search', () => {
        const transactionId = oid(0x1)
        const movieId = oid(0x2)
        const theaterId = oid(0x3)
        const showtimeId = oid(0x4)
        let createdTickets: TicketDto[]

        beforeEach(async () => {
            const createDtos = [{ transactionId }, { movieId }, { theaterId }, { showtimeId }]

            createdTickets = await createTickets(fixture, createDtos)
        })

        // `transactionIds`가 제공된 경우
        describe('when the `transactionIds` are provided', () => {
            // 지정한 transactionIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the transactionIds', async () => {
                const tickets = await fixture.ticketsService.search({
                    transactionIds: [transactionId]
                })

                expect(tickets).toEqual([createdTickets[0]])
            })
        })

        // `movieIds`가 제공된 경우
        describe('when the `movieIds` are provided', () => {
            // 지정한 movieIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the movieIds', async () => {
                const tickets = await fixture.ticketsService.search({ movieIds: [movieId] })

                expect(tickets).toEqual([createdTickets[1]])
            })
        })

        // `theaterIds`가 제공된 경우
        describe('when the `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the theaterIds', async () => {
                const tickets = await fixture.ticketsService.search({ theaterIds: [theaterId] })

                expect(tickets).toEqual([createdTickets[2]])
            })
        })

        // `showtimeIds`가 제공된 경우
        describe('when the `showtimeIds` are provided', () => {
            // 지정한 showtimeIds와 일치하는 티켓 목록을 반환한다.
            it('returns tickets for the showtimeIds', async () => {
                const tickets = await fixture.ticketsService.search({ showtimeIds: [showtimeId] })

                expect(tickets).toEqual([createdTickets[3]])
            })
        })

        // 필터가 비어있는 경우
        describe('when the filter is empty', () => {
            // 400 status를 던진다
            it('throws 400 status', async () => {
                const promise = fixture.ticketsService.search({})

                await expect(promise).rejects.toMatchObject({
                    status: 400,
                    message: 'At least one filter condition must be provided'
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

        // 티켓이 존재하는 경우
        describe('when the tickets exist', () => {
            // 티켓의 상태를 변경하고 변경된 티켓을 반환한다
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
        // `showtimeIds`가 제공된 경우
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

            // 지정한 showtimeIds에 대한 판매 통계를 반환한다
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
