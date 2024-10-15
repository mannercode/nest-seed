import { TicketDto, TicketsService, TicketStatus } from 'services/tickets'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    createTicketDtos,
    createTickets,
    IsolatedFixture
} from './tickets.fixture'
import { expectEqualUnsorted } from 'testlib'
import { pickIds } from 'common'

describe('TicketsModule', () => {
    let isolated: IsolatedFixture
    let service: TicketsService

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    it('createTickets', async () => {
        const { creationDtos, expectedDtos } = createTicketDtos()

        const tickets = await createTickets(service, creationDtos)
        expectEqualUnsorted(tickets, expectedDtos)
    })

    describe('findAllTickets', () => {
        let tickets: TicketDto[]

        beforeEach(async () => {
            const { creationDtos } = createTicketDtos()
            tickets = await createTickets(service, creationDtos)
        })

        const findAllTickets = async (overrides = {}, findFilter = {}) => {
            const { creationDtos, expectedDtos } = createTicketDtos(overrides)
            await service.createTickets(creationDtos)

            const tickets = await service.findAllTickets(findFilter)
            expectEqualUnsorted(tickets, expectedDtos)
        }

        it('batchIds', async () => {
            const batchId = '100000000000000000000001'
            await findAllTickets({ batchId }, { batchIds: [batchId] })
        })

        it('movieIds', async () => {
            const movieId = '100000000000000000000002'
            await findAllTickets({ movieId }, { movieIds: [movieId] })
        })

        it('theaterIds', async () => {
            const theaterId = '100000000000000000000003'
            await findAllTickets({ theaterId }, { theaterIds: [theaterId] })
        })

        it('showtimeIds', async () => {
            const showtimeId = '100000000000000000000004'
            await findAllTickets({ showtimeId }, { showtimeIds: [showtimeId] })
        })

        it('1개 이상의 필터를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const promise = findAllTickets({})
            await expect(promise).rejects.toThrow('At least one filter condition must be provided.')
        })
    })

    it('updateTicketStatus', async () => {
        const { creationDtos } = createTicketDtos({})
        const tickets = await createTickets(service, creationDtos)
        const ticket = tickets[0]
        expect(ticket.status).toEqual(TicketStatus.open)

        const updatedTickets = await service.updateTicketStatus([ticket.id], TicketStatus.sold)
        const updatedStatuses = updatedTickets.map((ticket) => ticket.status)
        expect(updatedStatuses).toEqual([TicketStatus.sold])
    })

    it('getSalesStatuses', async () => {
        const showtimeId = '400000000000000000000001'
        const ticketCount = 50
        const soldCount = 5

        const { creationDtos } = createTicketDtos({ showtimeId }, ticketCount)
        const tickets = await createTickets(service, creationDtos)
        const ticketIds = pickIds(tickets.slice(0, soldCount))
        await service.updateTicketStatus(ticketIds, TicketStatus.sold)
        const salesStatuses = await service.getSalesStatuses([showtimeId])

        expect(salesStatuses).toEqual([
            { showtimeId, total: ticketCount, sold: soldCount, available: ticketCount - soldCount }
        ])
    })
})
