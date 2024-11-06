import { generateUUID, sleep } from 'common'
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
    const showtimeId = 'showtimeId#1'
    const tickets = ['ticketId#1', 'ticketId#2']
    const ttlMs = 60 * 1000

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('holdTickets', () => {
        it('티켓을 정해진 시간 동안 선점해야 한다', async () => {
            const firstResult = await service.holdTickets(showtimeId, customerA, tickets, ttlMs)
            expect(firstResult).toBeTruthy()

            const secondResult = await service.holdTickets(showtimeId, customerB, tickets, ttlMs)
            expect(secondResult).toBeFalsy()
        })

        it('고객은 자신이 선점한 티켓을 다시 선점할 수 있다', async () => {
            const firstResult = await service.holdTickets(showtimeId, customerA, tickets, ttlMs)
            expect(firstResult).toBeTruthy()

            const secondResult = await service.holdTickets(showtimeId, customerA, tickets, ttlMs)
            expect(secondResult).toBeTruthy()
        })

        it('시간이 만료되면 티켓을 다시 선점할 수 있어야 한다', async () => {
            const holdDuration = 1000
            const initialResult = await service.holdTickets(
                showtimeId,
                customerA,
                tickets,
                holdDuration
            )
            expect(initialResult).toBeTruthy()

            await sleep(holdDuration + 500)

            const postExpiryResult = await service.holdTickets(
                showtimeId,
                customerB,
                tickets,
                holdDuration
            )
            expect(postExpiryResult).toBeTruthy()
        })

        it('동일한 고객이 새로운 티켓을 선점할 때 기존 티켓은 해제되어야 한다', async () => {
            const firstTickets = ['ticketId#1', 'ticketId#2']
            const newTickets = ['ticketId#3', 'ticketId#4']

            const holdA1 = await service.holdTickets(showtimeId, customerA, firstTickets, ttlMs)
            expect(holdA1).toBeTruthy()

            const holdA2 = await service.holdTickets(showtimeId, customerA, newTickets, ttlMs)
            expect(holdA2).toBeTruthy()

            const holdB = await service.holdTickets(showtimeId, customerB, firstTickets, ttlMs)
            expect(holdB).toBeTruthy()
        })

        it(
            '티켓이 중복 선점되면 안 된다',
            async () => {
                const results = await Promise.all(
                    Array.from({ length: 100 }, async () => {
                        const showtimeId = generateUUID()
                        const tickets = Array.from({ length: 5 }, generateUUID)
                        const customers = Array.from({ length: 10 }, generateUUID)

                        await Promise.all(
                            customers.map((customer) =>
                                service.holdTickets(showtimeId, customer, tickets, ttlMs)
                            )
                        )

                        const findResults = await Promise.all(
                            customers.map((customer) => service.findTicketIds(showtimeId, customer))
                        )

                        return findResults.flat().length === tickets.length
                    })
                )

                const allTrue = results.every((value) => value === true)
                expect(allTrue).toBeTruthy()
            },
            30 * 1000
        )
    })

    describe('findTicketIds', () => {
        it('선점한 티켓을 반환해야 한다', async () => {
            await service.holdTickets(showtimeId, customerA, tickets, ttlMs)
            const heldTickets = await service.findTicketIds(showtimeId, customerA)
            expect(heldTickets).toEqual(tickets)
        })

        it('만료된 티켓은 반환되지 않아야 한다', async () => {
            const ttlMs = 1000
            await service.holdTickets(showtimeId, customerA, tickets, ttlMs)

            await sleep(ttlMs + 500)

            const heldTickets = await service.findTicketIds(showtimeId, customerA)
            expect(heldTickets).toEqual([])
        })
    })

    describe('releaseTickets', () => {
        it('고객이 선점한 티켓을 해제해야 한다', async () => {
            await service.holdTickets(showtimeId, customerA, tickets, ttlMs)

            const releaseRes = await service.releaseTickets(showtimeId, customerA)
            expect(releaseRes).toBeTruthy()

            const heldTickets = await service.findTicketIds(showtimeId, customerA)
            expect(heldTickets).toEqual([])

            const secondResult = await service.holdTickets(showtimeId, customerB, tickets, ttlMs)
            expect(secondResult).toBeTruthy()
        })
    })
})
