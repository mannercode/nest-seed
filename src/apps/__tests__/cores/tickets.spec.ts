import { CreateTicketDto, TicketDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { expectEqualUnsorted, testObjectId } from 'testlib'
import { buildCreateTicketDto, createTickets } from '../common.fixture'
import { buildCreateTicketDtos, Fixture } from './tickets.fixture'
import { omit } from 'lodash'

describe('TicketsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./tickets.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createTickets()', () => {
        // 새로운 티켓을 성공적으로 생성한다.
        it('creates new tickets successfully', async () => {
            const createDto = buildCreateTicketDto()

            const tickets = await createTickets(fix, [createDto])
            expectEqualUnsorted(tickets, [
                { id: expect.any(String), ...omit(createDto, 'transactionId') }
            ])
        })
    })

    describe('searchTickets()', () => {
        const transactionIds = [testObjectId(0x10), testObjectId(0x11)]
        const movieIds = [testObjectId(0x20), testObjectId(0x21)]
        const theaterIds = [testObjectId(0x30), testObjectId(0x31)]
        const showtimeIds = [testObjectId(0x40), testObjectId(0x41)]
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

        // 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // transaction ID로 필터링된 티켓 목록을 반환한다.
            it('returns tickets filtered by transaction IDs', async () => {
                const tickets = await fix.ticketsClient.searchTickets({ transactionIds })
                expectEqualUnsorted(tickets, [expectedDtos[0], expectedDtos[1]])
            })

            // movie ID로 필터링된 티켓 목록을 반환한다.
            it('returns tickets filtered by movie IDs', async () => {
                const tickets = await fix.ticketsClient.searchTickets({ movieIds })
                expectEqualUnsorted(tickets, [expectedDtos[2], expectedDtos[3]])
            })

            // theater ID로 필터링된 티켓 목록을 반환한다.
            it('returns tickets filtered by theater IDs', async () => {
                const tickets = await fix.ticketsClient.searchTickets({ theaterIds })
                expectEqualUnsorted(tickets, [expectedDtos[4], expectedDtos[5]])
            })

            // showtime ID로 필터링된 티켓 목록을 반환한다.
            it('returns tickets filtered by showtime IDs', async () => {
                const tickets = await fix.ticketsClient.searchTickets({ showtimeIds })
                expectEqualUnsorted(tickets, [expectedDtos[6], expectedDtos[7]])
            })
        })

        // 필터 조건이 제공되지 않았을 때
        describe('when no filter is provided', () => {
            // 에러를 던진다.
            it('throws an error', async () => {
                const promise = fix.ticketsClient.searchTickets({})
                await expect(promise).rejects.toThrow(
                    'At least one filter condition must be provided'
                )
            })
        })
    })

    describe('updateTicketStatus()', () => {
        const transactionId = testObjectId(0x01)
        let tickets: TicketDto[]

        const getStatus = async () => {
            const tickets = await fix.ticketsClient.searchTickets({
                transactionIds: [transactionId]
            })
            return tickets.map((ticket) => ticket.status)
        }

        beforeEach(async () => {
            const createDtos = [
                buildCreateTicketDto({ transactionId }),
                buildCreateTicketDto({ transactionId })
            ]
            const { success } = await fix.ticketsClient.createTickets(createDtos)
            expect(success).toBeTruthy()

            tickets = await fix.ticketsClient.searchTickets({ transactionIds: [transactionId] })
        })

        // 지정된 티켓의 상태를 변경한다.
        it('changes the status of the specified tickets', async () => {
            expect(await getStatus()).toEqual([TicketStatus.Available, TicketStatus.Available])

            const updatedTickets = await fix.ticketsClient.updateTicketStatus(
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

    describe('getTicketSalesForShowtimes()', () => {
        // 주어진 상영시간에 대한 판매 통계를 반환한다.
        it('returns the sales statistics for the given showtimes', async () => {
            const showtimeId = testObjectId(0x10)
            const ticketCount = 50
            const soldCount = 5

            const createDtos = buildCreateTicketDtos({ showtimeId }, ticketCount)
            const tickets = await createTickets(fix, createDtos)

            const ticketIds = pickIds(tickets.slice(0, soldCount))
            await fix.ticketsClient.updateTicketStatus(ticketIds, TicketStatus.Sold)

            const ticketSalesForShowtimes = await fix.ticketsClient.getTicketSalesForShowtimes([
                showtimeId
            ])

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
