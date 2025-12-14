import { sleep } from 'common'
import { intersection, sortBy } from 'lodash'
import { oid, toAny } from 'testlib'
import { holdTickets, releaseTickets, searchHeldTicketIds } from '../__helpers__'
import type { TicketHoldingFixture } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fix: TicketHoldingFixture

    beforeEach(async () => {
        const { createTicketHoldingFixture } = await import('./ticket-holding.fixture')
        fix = await createTicketHoldingFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('holdTickets', () => {
        const customerA = oid(0x1001)
        const customerB = oid(0x1002)

        it('returns true when the tickets are not held', async () => {
            const isHeld = await holdTickets(fix, { customerId: customerA })

            expect(isHeld).toBe(true)
        })

        describe('when the tickets are held by another customer', () => {
            beforeEach(async () => {
                await holdTickets(fix, { customerId: customerA })
            })

            it('returns false', async () => {
                const isHeld = await holdTickets(fix, { customerId: customerB })

                expect(isHeld).toBe(false)
            })
        })

        describe('when the customer already holds tickets', () => {
            const showtimeId = oid(0x2001)
            const prevTicketIds = [oid(0x30), oid(0x31)]
            const newTicketIds = [oid(0x40), oid(0x41)]
            const holdDuration = 1000

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = holdDuration

                await holdTickets(fix, {
                    showtimeId,
                    customerId: customerA,
                    ticketIds: prevTicketIds
                })
            })

            it('returns true for re-holding the same tickets', async () => {
                const isHeld = await holdTickets(fix, {
                    showtimeId,
                    customerId: customerA,
                    ticketIds: prevTicketIds
                })

                expect(isHeld).toBe(true)
            })

            describe('when the customer holds new tickets', () => {
                let isHeld: boolean

                beforeEach(async () => {
                    isHeld = await holdTickets(fix, {
                        showtimeId,
                        customerId: customerA,
                        ticketIds: newTicketIds
                    })
                })

                it('returns true', async () => {
                    expect(isHeld).toBe(true)
                })

                it('releases the previously held tickets', async () => {
                    const heldTicketIds = await searchHeldTicketIds(fix, showtimeId, customerA)

                    expect(intersection(heldTicketIds, prevTicketIds)).toHaveLength(0)
                })
            })

            describe('when the hold duration has expired', () => {
                beforeEach(async () => {
                    await sleep(holdDuration + 500)
                })

                it('returns true for another customer', async () => {
                    const isHeld = await holdTickets(fix, {
                        showtimeId,
                        customerId: customerB,
                        ticketIds: prevTicketIds
                    })

                    expect(isHeld).toBe(true)
                })
            })
        })

        it(
            'returns true for only one customer when multiple customers attempt to hold concurrently',
            async () => {
                const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                const customerIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))

                const batchResults = await Promise.all(
                    Array.from({ length: 100 }, async (_, index) => {
                        const showtimeId = oid(0x1000 + index)

                        const holdResults = await Promise.all(
                            customerIds.map((customerId) =>
                                holdTickets(fix, { customerId, showtimeId, ticketIds })
                            )
                        )

                        const successfulCount = holdResults.filter(Boolean).length

                        const allHeldTicketIds = await Promise.all(
                            customerIds.map((customerId) =>
                                searchHeldTicketIds(fix, showtimeId, customerId)
                            )
                        )

                        return { successfulCount, heldTicketIds: allHeldTicketIds.flat() }
                    })
                )

                const actual = batchResults.map(({ successfulCount, heldTicketIds }) => ({
                    successfulCount,
                    heldTicketIds: sortBy(heldTicketIds)
                }))
                const expected = Array(batchResults.length).fill({
                    successfulCount: 1,
                    heldTicketIds: ticketIds
                })

                expect(actual).toEqual(expected)
            },
            60 * 1000
        )
    })

    describe('searchHeldTicketIds', () => {
        const customerId = oid(0x1001)
        const showtimeId = oid(0x2001)
        const ticketIds = [oid(0x3001), oid(0x3002)]
        const holdDuration = 1000

        beforeEach(async () => {
            const { Rules } = await import('shared')
            toAny(Rules).Ticket.holdDurationInMs = holdDuration

            await holdTickets(fix, { showtimeId, customerId, ticketIds })
        })

        it('returns the ticketIds when the tickets are still held', async () => {
            const heldTicketIds = await searchHeldTicketIds(fix, showtimeId, customerId)

            expect(heldTicketIds).toEqual(ticketIds)
        })

        describe('when the hold duration has expired', () => {
            beforeEach(async () => {
                await sleep(holdDuration + 500)
            })

            it('returns an empty array', async () => {
                const heldTicketIds = await searchHeldTicketIds(fix, showtimeId, customerId)

                expect(heldTicketIds).toHaveLength(0)
            })
        })
    })

    describe('releaseTickets', () => {
        const customerId = oid(0x1001)
        const showtimeId = oid(0x2001)
        const ticketIds = [oid(0x3001), oid(0x3002)]

        describe('when the customer holds tickets', () => {
            beforeEach(async () => {
                await holdTickets(fix, { showtimeId, customerId, ticketIds })
            })

            it('returns true', async () => {
                const isReleased = await releaseTickets(fix, showtimeId, customerId)

                expect(isReleased).toBe(true)
            })
        })

        it('returns true when the customer holds no tickets', async () => {
            const isReleased = await releaseTickets(fix, showtimeId, customerId)

            expect(isReleased).toBe(true)
        })
    })
})
