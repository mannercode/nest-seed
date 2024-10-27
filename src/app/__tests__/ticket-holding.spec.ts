import { TicketHoldingService } from 'services/ticket-holding'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    IsolatedFixture
} from './ticket-holding.fixture'
import { sleep } from 'common'

describe.skip('TicketHolding Module', () => {
    let isolated: IsolatedFixture
    let service: TicketHoldingService

    const customerId = 'customerId#1'
    const ticketIds = ['ticketId#1', 'ticketId#2']
    const durationInMinutes = 1 / 60 // 1sec

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('holdTickets', () => {
        it('정해진 시간 동안 티켓을 선점해야 한다', async () => {
            const result1 = await service.holdTickets(customerId, ticketIds, durationInMinutes)
            expect(result1).toBeTruthy()

            const result2 = await service.holdTickets(customerId, ticketIds, durationInMinutes)
            expect(result2).toBeFalsy()
        })

        it('시간이 만료되면 티켓을 다시 선점할 수 있어야 한다', async () => {
            const result1 = await service.holdTickets(customerId, ticketIds, durationInMinutes)
            expect(result1).toBeTruthy()

            await sleep(durationInMinutes * 60 * 1000 * 1.5)

            const result3 = await service.holdTickets(customerId, ticketIds, durationInMinutes)
            expect(result3).toBeTruthy()
        })

        it('동일한 고객이 새로운 티켓을 선점할 때 기존 티켓이 해제된다', async () => {
            const firstTicketIds = ['ticketId#1', 'ticketId#2']
            const newTicketIds = ['ticketId#3', 'ticketId#4']

            const result1 = await service.holdTickets(customerId, firstTicketIds, durationInMinutes)
            expect(result1).toBeTruthy()

            const result2 = await service.holdTickets(customerId, newTicketIds, durationInMinutes)
            expect(result2).toBeTruthy()

            const heldTickets = await service.findHeldTicketIds(customerId)
            expect(heldTickets).toEqual(newTicketIds) // 기존 티켓이 해제되고 새로운 티켓이 선점됨
        })
    })

    describe('findHeldTicketIds', () => {
        it('선점한 티켓을 반환해야 한다', async () => {
            await service.holdTickets(customerId, ticketIds, durationInMinutes)
            const heldTickets = await service.findHeldTicketIds(customerId)
            expect(heldTickets).toEqual(ticketIds)
        })

        it('만료된 티켓은 반환되지 않아야 한다', async () => {
            await service.holdTickets(customerId, ticketIds, durationInMinutes)

            await sleep(durationInMinutes * 60 * 1000 * 1.5)

            const heldTickets = await service.findHeldTicketIds(customerId)
            expect(heldTickets).toEqual([])
        })
    })

    describe('releaseTickets', () => {
        it('선점한 티켓을 해제하면 true를 반환한다', async () => {
            await service.holdTickets(customerId, ticketIds, durationInMinutes)
            const result = await service.releaseTickets(ticketIds)
            expect(result).toBeTruthy()

            const heldTickets = await service.findHeldTicketIds(customerId)
            expect(heldTickets).toEqual([])
        })

        it('선점되지 않은 티켓을 해제해도 true를 반환한다', async () => {
            const nonHeldTicketIds = ['ticketId#3', 'ticketId#4']
            const result = await service.releaseTickets(nonHeldTicketIds)
            expect(result).toBeTruthy()
        })

        it('부분적으로 선점된 티켓을 해제하면 해당 티켓만 해제된다', async () => {
            const partiallyHeldTicketIds = ['ticketId#1', 'ticketId#2']
            await service.holdTickets(customerId, partiallyHeldTicketIds, durationInMinutes)

            const ticketIdsToRelease = ['ticketId#2', 'ticketId#3']
            const result = await service.releaseTickets(ticketIdsToRelease)
            expect(result).toBeTruthy()

            const heldTickets = await service.findHeldTicketIds(customerId)
            expect(heldTickets).toEqual(['ticketId#1'])
        })
    })
})
