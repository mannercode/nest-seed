import { pickIds } from 'common'
import { TicketsService, TicketStatus } from 'services/cores'
import { expectEqualUnsorted, testObjectId } from 'testlib'
import {
    closeFixture,
    createFixture,
    createTicketDtos,
    createTickets,
    Fixture
} from './tickets.fixture'

describe('Tickets Module', () => {
    let fixture: Fixture
    let service: TicketsService

    beforeEach(async () => {
        fixture = await createFixture()
        service = fixture.ticketsService
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    it('createTickets', async () => {
        const { createDtos, expectedDtos } = createTicketDtos()

        const tickets = await createTickets(service, createDtos)
        expectEqualUnsorted(tickets, expectedDtos)
    })

    describe('findAllTickets', () => {
        beforeEach(async () => {
            const { createDtos } = createTicketDtos()
            await createTickets(service, createDtos)
        })

        const createAndFindTickets = async (overrides = {}, findFilter = {}) => {
            const { createDtos, expectedDtos } = createTicketDtos(overrides)
            await service.createTickets(createDtos)

            const tickets = await service.findAllTickets(findFilter)
            expectEqualUnsorted(tickets, expectedDtos)
        }

        it('batchIds', async () => {
            const batchId = testObjectId('a1')
            await createAndFindTickets({ batchId }, { batchIds: [batchId] })
        })

        it('movieIds', async () => {
            const movieId = testObjectId('a1')
            await createAndFindTickets({ movieId }, { movieIds: [movieId] })
        })

        it('theaterIds', async () => {
            const theaterId = testObjectId('a1')
            await createAndFindTickets({ theaterId }, { theaterIds: [theaterId] })
        })

        it('showtimeIds', async () => {
            const showtimeId = testObjectId('a1')
            await createAndFindTickets({ showtimeId }, { showtimeIds: [showtimeId] })
        })

        it('1개 이상의 필터를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const promise = createAndFindTickets({})
            await expect(promise).rejects.toThrow('At least one filter condition must be provided.')
        })
    })

    it('updateTicketStatus', async () => {
        const { createDtos } = createTicketDtos({})
        const tickets = await createTickets(service, createDtos)
        const ticket = tickets[0]
        expect(ticket.status).toEqual(TicketStatus.available)

        const updatedTickets = await service.updateTicketStatus([ticket.id], TicketStatus.sold)
        const updatedStatuses = updatedTickets.map((ticket) => ticket.status)
        expect(updatedStatuses).toEqual([TicketStatus.sold])
    })

    it('getSalesStatuses', async () => {
        const showtimeId = testObjectId('a1')
        const ticketCount = 50
        const soldCount = 5

        const { createDtos } = createTicketDtos({ showtimeId }, ticketCount)
        const tickets = await createTickets(service, createDtos)
        const ticketIds = pickIds(tickets.slice(0, soldCount))
        await service.updateTicketStatus(ticketIds, TicketStatus.sold)
        const salesStatuses = await service.getSalesStatuses([showtimeId])

        expect(salesStatuses).toEqual([
            { showtimeId, total: ticketCount, sold: soldCount, available: ticketCount - soldCount }
        ])
    })
})
