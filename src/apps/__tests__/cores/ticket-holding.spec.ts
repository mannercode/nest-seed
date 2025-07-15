import { generateShortId, sleep } from 'common'
import { isEqual, sortBy } from 'lodash'
import { testObjectId } from 'testlib'
import { Fixture, holdTickets, releaseTickets, searchHeldTicketIds } from './ticket-holding.fixture'

describe('Ticket Holding', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./ticket-holding.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('holdTickets', () => {
        // 티켓을 정해진 시간 동안 선점해야 한다
        it('Should hold tickets for a specified period', async () => {
            const firstCustomerHold = await holdTickets(fix, { customerId: testObjectId(0x1) })
            expect(firstCustomerHold).toBeTruthy()

            const secondCustomerHold = await holdTickets(fix, { customerId: testObjectId(0x2) })
            expect(secondCustomerHold).toBeFalsy()
        })

        // 고객은 자신이 선점한 티켓을 다시 선점할 수 있다
        it('Should allow a customer to hold tickets they already hold', async () => {
            const firstHold = await holdTickets(fix)
            expect(firstHold).toBeTruthy()

            const secondHold = await holdTickets(fix)
            expect(secondHold).toBeTruthy()
        })

        // 시간이 만료되면 티켓을 다시 선점할 수 있어야 한다
        it('Should allow re-holding tickets after the hold period expires', async () => {
            const { Rules } = await import('shared')
            Rules.Ticket.holdDurationInMs = 1000

            const initialHold = await holdTickets(fix, { customerId: testObjectId(0x1) })
            expect(initialHold).toBeTruthy()

            const holdBeforeExpiry = await holdTickets(fix, { customerId: testObjectId(0x2) })
            expect(holdBeforeExpiry).toBeFalsy()

            await sleep(Rules.Ticket.holdDurationInMs + 500)

            const holdAfterExpiry = await holdTickets(fix, { customerId: testObjectId(0x2) })
            expect(holdAfterExpiry).toBeTruthy()
        })

        // 동일 고객이 새로운 티켓을 선점하면 기존 티켓은 해제되어야 한다
        it('Should release previously held tickets if the same customer holds new tickets', async () => {
            const oldTickets = [testObjectId(0x30), testObjectId(0x31)]
            const newTickets = [testObjectId(0x40), testObjectId(0x41)]

            const firstHold = await holdTickets(fix, {
                customerId: testObjectId(0x1),
                ticketIds: oldTickets
            })
            expect(firstHold).toBeTruthy()

            const secondHold = await holdTickets(fix, {
                customerId: testObjectId(0x1),
                ticketIds: newTickets
            })
            expect(secondHold).toBeTruthy()

            const competitorHold = await holdTickets(fix, {
                customerId: testObjectId(0x2),
                ticketIds: oldTickets
            })
            expect(competitorHold).toBeTruthy()
        })

        // 서로 다른 고객이 동시에 선점 요청을 해도 중복 선점되면 안 된다
        it(
            'should not allow duplicate holds even if different customers request holds simultaneously',
            async () => {
                const results = await Promise.all(
                    Array.from({ length: 100 }, async () => {
                        const showtimeId = generateShortId()
                        const ticketIds = Array.from({ length: 5 }, generateShortId)
                        const customers = Array.from({ length: 10 }, generateShortId)

                        await Promise.all(
                            customers.map((customer) =>
                                holdTickets(fix, { customerId: customer, showtimeId, ticketIds })
                            )
                        )

                        const heldTicketIds = await Promise.all(
                            customers.map((customer) =>
                                searchHeldTicketIds(fix, showtimeId, customer)
                            )
                        )

                        return isEqual(sortBy(heldTicketIds.flat()), sortBy(ticketIds))
                    })
                )

                const allTrue = results.every((value) => value === true)
                expect(allTrue).toBeTruthy()
            },
            60 * 1000
        )
    })

    describe('searchHeldTicketIds', () => {
        const customerId = testObjectId(0x10)
        const ticketIds = [testObjectId(0x30), testObjectId(0x31)]
        const showtimeId = testObjectId(0x40)

        // 선점한 티켓을 반환해야 한다
        it('Should return held tickets', async () => {
            await holdTickets(fix, { showtimeId, customerId, ticketIds })

            const heldTickets = await searchHeldTicketIds(fix, showtimeId, customerId)

            expect(heldTickets).toEqual(ticketIds)
        })

        // 만료된 티켓은 반환되지 않아야 한다
        it('Should not return expired tickets', async () => {
            const { Rules } = await import('shared')
            Rules.Ticket.holdDurationInMs = 1000

            await holdTickets(fix, { showtimeId, customerId, ticketIds })

            const beforeExpiry = await searchHeldTicketIds(fix, showtimeId, customerId)
            expect(beforeExpiry).toEqual(ticketIds)

            await sleep(Rules.Ticket.holdDurationInMs + 500)

            const afterExpiry = await searchHeldTicketIds(fix, showtimeId, customerId)
            expect(afterExpiry).toEqual([])
        })
    })

    describe('releaseTickets', () => {
        const customerId = testObjectId(0x1)
        const customerB = testObjectId(0x2)
        const ticketIds = [testObjectId(0x30), testObjectId(0x31)]
        const showtimeId = testObjectId(0x1)

        // 고객이 선점한 티켓을 해제해야 한다
        it('Should release tickets held by the customer', async () => {
            const firstHold = await holdTickets(fix, { customerId, showtimeId, ticketIds })
            expect(firstHold).toBeTruthy()

            const beforeRelease = await searchHeldTicketIds(fix, showtimeId, customerId)
            expect(beforeRelease).toEqual(ticketIds)

            const releaseResult = await releaseTickets(fix, showtimeId, customerId)
            expect(releaseResult).toBeTruthy()

            const afterRelease = await searchHeldTicketIds(fix, showtimeId, customerId)
            expect(afterRelease).toEqual([])

            const secondHold = await holdTickets(fix, {
                customerId: customerB,
                showtimeId,
                ticketIds
            })
            expect(secondHold).toBeTruthy()
        })
    })
})
