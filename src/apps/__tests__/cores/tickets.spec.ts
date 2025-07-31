import { CreateTicketDto, TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { omit } from 'lodash'
import { expectEqualUnsorted, oid } from 'testlib'
import { buildCreateTicketDto, createTickets } from '../__fixtures__'
import { buildCreateTicketDtos, Fixture } from './tickets.fixture'

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
        describe('when the payload is valid', () => {
            // 티켓을 생성하고 반환한다
            it('creates and returns the tickets', async () => {
                const createDto = buildCreateTicketDto()

                const tickets = await createTickets(fix, [createDto])

                expectEqualUnsorted(tickets, [
                    { id: expect.any(String), ...omit(createDto, 'transactionId') }
                ])
            })
        })
    })

    describe('searchTickets', () => {
        const transactionIds = [oid(0x10), oid(0x11)]
        const movieIds = [oid(0x20), oid(0x21)]
        const theaterIds = [oid(0x30), oid(0x31)]
        const showtimeIds = [oid(0x40), oid(0x41)]
        let createDtos: CreateTicketDto[] = []
        let expectedDtos: TicketDto[]

        beforeEach(async () => {
            createDtos = [
                buildCreateTicketDto({ transactionId: transactionIds[0] }),
                buildCreateTicketDto({ transactionId: transactionIds[1] }),
                buildCreateTicketDto({ movieId: movieIds[0] }),
                buildCreateTicketDto({ movieId: movieIds[1] }),
                buildCreateTicketDto({ theaterId: theaterIds[0] }),
                buildCreateTicketDto({ theaterId: theaterIds[1] }),
                buildCreateTicketDto({ showtimeId: showtimeIds[0] }),
                buildCreateTicketDto({ showtimeId: showtimeIds[1] })
            ]

            const { success } = await fix.ticketsService.createTickets(createDtos)
            expect(success).toBeTruthy()

            expectedDtos = createDtos.map((createDto) => ({
                id: expect.any(String),
                ...omit(createDto, 'transactionId')
            }))
        })

        // `transactionIds`가 제공된 경우
        describe('when `transactionIds` are provided', () => {
            // 지정한 transactionIds와 일치하는 티켓 목록을 반환한다.
            it('returns the tickets matching the given transactionIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ transactionIds })

                expectEqualUnsorted(tickets, [expectedDtos[0], expectedDtos[1]])
            })
        })

        // `movieIds`가 제공된 경우
        describe('when `movieIds` are provided', () => {
            // 지정한 movieIds와 일치하는 티켓 목록을 반환한다.
            it('returns the tickets matching the given movieIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ movieIds })

                expectEqualUnsorted(tickets, [expectedDtos[2], expectedDtos[3]])
            })
        })

        // `theaterIds`가 제공된 경우
        describe('when `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 티켓 목록을 반환한다.
            it('returns the tickets matching the given theaterIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ theaterIds })
                expectEqualUnsorted(tickets, [expectedDtos[4], expectedDtos[5]])
            })
        })

        // `showtimeIds`가 제공된 경우
        describe('when `showtimeIds` are provided', () => {
            // 지정한 showtimeIds와 일치하는 티켓 목록을 반환한다.
            it('returns the tickets matching the given showtimeIds', async () => {
                const tickets = await fix.ticketsService.searchTickets({ showtimeIds })
                expectEqualUnsorted(tickets, [expectedDtos[6], expectedDtos[7]])
            })
        })

        // 필터가 비어있는 경우
        describe('when the filter is empty', () => {
            // 에러를 던진다.
            it('throws an error', async () => {
                const promise = fix.ticketsService.searchTickets({})

                await expect(promise).rejects.toThrow(
                    'At least one filter condition must be provided'
                )
            })
        })
    })

    describe('updateTicketsStatus', () => {
        const transactionId = oid(0x01)
        let tickets: TicketDto[]

        const getStatus = async () => {
            const tickets = await fix.ticketsService.searchTickets({
                transactionIds: [transactionId]
            })
            return tickets.map((ticket) => ticket.status)
        }

        beforeEach(async () => {
            const createDtos = [
                buildCreateTicketDto({ transactionId }),
                buildCreateTicketDto({ transactionId })
            ]
            const { success } = await fix.ticketsService.createTickets(createDtos)
            expect(success).toBeTruthy()

            tickets = await fix.ticketsService.searchTickets({ transactionIds: [transactionId] })
        })

        // 티켓이 존재하는 경우
        describe('when the tickets exist', () => {
            // 티켓의 상태를 변경하고 변경된 티켓을 반환한다
            it('updates the tickets’ status and returns the updated tickets ', async () => {
                expect(await getStatus()).toEqual([TicketStatus.Available, TicketStatus.Available])

                const updatedTickets = await fix.ticketsService.updateTicketsStatus(
                    pickIds(tickets),
                    TicketStatus.Sold
                )
                expect(updatedTickets.map((ticket) => ticket.status)).toEqual([
                    TicketStatus.Sold,
                    TicketStatus.Sold
                ])

                expect(await getStatus()).toEqual([TicketStatus.Sold, TicketStatus.Sold])
            })
        })
    })

    describe('aggregateTicketSales', () => {
        // 티켓이 존재하는 경우
        describe('when the tickets exist', () => {
            // 주어진 상영시간에 대한 판매 통계를 반환한다.
            it('returns the sales statistics for the given showtimes', async () => {
                const showtimeId = oid(0x10)
                const ticketCount = 50
                const soldCount = 5

                const createDtos = buildCreateTicketDtos({ showtimeId }, ticketCount)
                const tickets = await createTickets(fix, createDtos)

                const ticketIds = pickIds(tickets.slice(0, soldCount))
                await fix.ticketsService.updateTicketsStatus(ticketIds, TicketStatus.Sold)

                const ticketSalesForShowtimes = await fix.ticketsService.aggregateTicketSales({
                    showtimeIds: [showtimeId]
                })

                expect(ticketSalesForShowtimes).toEqual([
                    {
                        showtimeId,
                        total: ticketCount,
                        sold: soldCount,
                        available: ticketCount - soldCount
                    }
                ])
            })
        })
    })
})
