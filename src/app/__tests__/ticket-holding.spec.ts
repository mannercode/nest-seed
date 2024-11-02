import { sleep } from 'common'
import { TicketHoldingService } from 'services/ticket-holding'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    IsolatedFixture
} from './ticket-holding.fixture'

describe('TicketHolding Module', () => {
    let isolated: IsolatedFixture
    let service: TicketHoldingService

    const customerA = 'customerId#1'
    const customerB = 'customerId#2'
    const initTickets = ['ticketId#1', 'ticketId#2']
    const holdDuration = 60 * 1000

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('holdTickets', () => {
        it('티켓을 정해진 시간 동안 선점해야 한다', async () => {
            const firstResult = await service.holdTickets(customerA, initTickets, holdDuration)
            expect(firstResult).toBeTruthy()

            const secondResult = await service.holdTickets(customerB, initTickets, holdDuration)
            expect(secondResult).toBeFalsy()
        })

        it('고객은 자신이 선점한 티켓을 다시 선점할 수 있다', async () => {
            const firstResult = await service.holdTickets(customerA, initTickets, holdDuration)
            expect(firstResult).toBeTruthy()

            const secondResult = await service.holdTickets(customerA, initTickets, holdDuration)
            expect(secondResult).toBeTruthy()
        })

        it('시간이 만료되면 티켓을 다시 선점할 수 있어야 한다', async () => {
            const holdDuration = 1000
            const initialResult = await service.holdTickets(customerA, initTickets, holdDuration)
            expect(initialResult).toBeTruthy()

            await sleep(holdDuration + 500)

            const postExpiryResult = await service.holdTickets(customerB, initTickets, holdDuration)
            expect(postExpiryResult).toBeTruthy()
        })

        it('동일한 고객이 새로운 티켓을 선점할 때 기존 티켓은 해제되어야 한다', async () => {
            const firstTickets = ['ticketId#1', 'ticketId#2']
            const newTickets = ['ticketId#3', 'ticketId#4']

            const holdA1 = await service.holdTickets(customerA, firstTickets, holdDuration)
            expect(holdA1).toBeTruthy()

            const holdA2 = await service.holdTickets(customerA, newTickets, holdDuration)
            expect(holdA2).toBeTruthy()

            const holdB = await service.holdTickets(customerB, firstTickets, holdDuration)
            expect(holdB).toBeTruthy()
        })
    })

    describe('findHeldTicketIds', () => {
        it('선점한 티켓을 반환해야 한다', async () => {
            await service.holdTickets(customerA, initTickets, holdDuration)
            const heldTickets = await service.findHeldTicketIds(customerA)
            expect(heldTickets).toEqual(initTickets)
        })

        it('만료된 티켓은 반환되지 않아야 한다', async () => {
            const holdDuration = 1000
            await service.holdTickets(customerA, initTickets, holdDuration)

            await sleep(holdDuration + 500)

            const heldTickets = await service.findHeldTicketIds(customerA)
            expect(heldTickets).toEqual([])
        })
    })

    describe('releaseTickets', () => {
        it('고객이 선점한 티켓을 해제해야 한다', async () => {
            await service.holdTickets(customerA, initTickets, holdDuration)

            const releaseRes = await service.releaseAllTickets(customerA)
            expect(releaseRes).toBeTruthy()

            const heldTickets = await service.findHeldTicketIds(customerA)
            expect(heldTickets).toEqual([])
        })
    })
})
