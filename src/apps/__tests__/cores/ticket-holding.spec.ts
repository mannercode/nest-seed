import { sleep } from 'common'
import { intersection, sortBy } from 'lodash'
import { oid } from 'testlib'
import { holdTickets, releaseTickets, searchHeldTicketIds } from '../__helpers__'
import type { Fixture } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./ticket-holding.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('holdTickets', () => {
        const customerA = oid(0x1001)
        const customerB = oid(0x1002)

        // 선점되지 않은 티켓인 경우
        describe('when tickets are not held', () => {
            // true를 반환한다
            it('returns true', async () => {
                const isHeld = await holdTickets(fixture, { customerId: customerA })

                expect(isHeld).toBe(true)
            })
        })

        // 다른 고객이 선점한 티켓인 경우
        describe('when tickets are held by another customer', () => {
            beforeEach(async () => {
                await holdTickets(fixture, { customerId: customerA })
            })

            // false를 반환한다
            it('returns false', async () => {
                const isHeld = await holdTickets(fixture, { customerId: customerB })

                expect(isHeld).toBe(false)
            })
        })

        // 고객이 선점한 티켓이 있는 경우
        describe('when customer already holds tickets', () => {
            const showtimeId = oid(0x2001)
            const prevTicketIds = [oid(0x30), oid(0x31)]
            const newTicketIds = [oid(0x40), oid(0x41)]
            const holdDuration = 1000

            beforeEach(async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.holdDurationInMs = holdDuration

                await holdTickets(fixture, {
                    showtimeId,
                    customerId: customerA,
                    ticketIds: prevTicketIds
                })
            })

            // 동일 티켓을 다시 선점하면 true를 반환한다
            it('returns true when re-holding the same tickets', async () => {
                const isHeld = await holdTickets(fixture, {
                    showtimeId,
                    customerId: customerA,
                    ticketIds: prevTicketIds
                })

                expect(isHeld).toBe(true)
            })

            // 새로운 티켓을 선점하면
            describe('when customer holds new tickets', () => {
                let isHeld: boolean

                beforeEach(async () => {
                    isHeld = await holdTickets(fixture, {
                        showtimeId,
                        customerId: customerA,
                        ticketIds: newTicketIds
                    })
                })

                // true를 반환한다
                it('returns true', async () => {
                    expect(isHeld).toBe(true)
                })

                // 기존에 선점했던 티켓은 해제된다
                it('releases the previously held tickets', async () => {
                    const heldTicketIds = await searchHeldTicketIds(fixture, showtimeId, customerA)

                    expect(intersection(heldTicketIds, prevTicketIds)).toHaveLength(0)
                })
            })

            // 선점 시간이 만료되면
            describe('when hold duration has expired', () => {
                beforeEach(async () => {
                    await sleep(holdDuration + 500)
                })

                // 다른 고객이 선점하면 true를 반환한다
                it('returns true for another customer', async () => {
                    const isHeld = await holdTickets(fixture, {
                        showtimeId,
                        customerId: customerB,
                        ticketIds: prevTicketIds
                    })

                    expect(isHeld).toBe(true)
                })
            })
        })

        // 여러 고객이 동시에 선점을 요청하는 경우
        describe('when multiple customers attempt to hold concurrently', () => {
            // 오직 한 고객만 성공한다
            it(
                'returns success for only one customer',
                async () => {
                    const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                    const customerIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))

                    const batchResults = await Promise.all(
                        Array.from({ length: 100 }, async (_, index) => {
                            const showtimeId = oid(0x1000 + index)

                            const holdResults = await Promise.all(
                                customerIds.map((customerId) =>
                                    holdTickets(fixture, { customerId, showtimeId, ticketIds })
                                )
                            )

                            const successfulCount = holdResults.filter(Boolean).length

                            const allHeldTicketIds = await Promise.all(
                                customerIds.map((customerId) =>
                                    searchHeldTicketIds(fixture, showtimeId, customerId)
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
    })

    describe('searchHeldTicketIds', () => {
        const customerId = oid(0x1001)
        const showtimeId = oid(0x2001)
        const ticketIds = [oid(0x3001), oid(0x3002)]
        const holdDuration = 1000

        beforeEach(async () => {
            const { Rules } = await import('shared')
            Rules.Ticket.holdDurationInMs = holdDuration

            await holdTickets(fixture, { showtimeId, customerId, ticketIds })
        })

        // 선점한 티켓이 존재하는 경우
        describe('when tickets are still held', () => {
            // 티켓 ID를 반환한다
            it('returns the ticket IDs', async () => {
                const heldTicketIds = await searchHeldTicketIds(fixture, showtimeId, customerId)

                expect(heldTicketIds).toEqual(ticketIds)
            })
        })

        // 선점한 티켓이 만료된 경우
        describe('when hold has expired', () => {
            beforeEach(async () => {
                await sleep(holdDuration + 500)
            })

            // 빈 배열을 반환한다.
            it('returns an empty array', async () => {
                const heldTicketIds = await searchHeldTicketIds(fixture, showtimeId, customerId)

                expect(heldTicketIds).toHaveLength(0)
            })
        })
    })

    describe('releaseTickets', () => {
        const customerId = oid(0x1001)
        const showtimeId = oid(0x2001)
        const ticketIds = [oid(0x3001), oid(0x3002)]

        // 고객이 선점한 티켓이 있는 경우
        describe('when customer holds tickets', () => {
            beforeEach(async () => {
                await holdTickets(fixture, { showtimeId, customerId, ticketIds })
            })

            // true를 반환한다
            it('returns true', async () => {
                const isReleased = await releaseTickets(fixture, showtimeId, customerId)

                expect(isReleased).toBe(true)
            })
        })

        // 고객이 선점한 티켓이 없는 경우
        describe('when customer holds no tickets', () => {
            // 선점한 티켓이 없어도 true를 반환한다
            it('returns true even when there are no tickets to release', async () => {
                const isReleased = await releaseTickets(fixture, showtimeId, customerId)

                expect(isReleased).toBe(true)
            })
        })
    })
})
