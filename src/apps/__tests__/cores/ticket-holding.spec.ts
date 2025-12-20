import type { HoldTicketsDto } from 'apps/cores'
import { sleep } from 'common'
import { oid, toAny } from 'testlib'
import { buildHoldTicketsDto } from '../__helpers__'
import type { TicketHoldingFixture } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fix: TicketHoldingFixture

    beforeEach(async () => {
        const { createTicketHoldingFixture } = await import('./ticket-holding.fixture')
        fix = await createTicketHoldingFixture()
    })
    afterEach(() => fix.teardown())

    describe('holdTickets', () => {
        describe('when the ticketIds are not held', () => {
            it('returns true', async () => {
                const holdDto = buildHoldTicketsDto()

                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        describe('when the customer already holds tickets', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const customerId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId })
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            it('returns true for re-holding the same ticketIds', async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('returns false for another customer', async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            describe('when the customer holds different ticketIds', () => {
                beforeEach(async () => {
                    const holdDto = buildHoldTicketsDto({
                        ticketIds: [oid(0xb0), oid(0xb1)],
                        customerId
                    })
                    await fix.ticketHoldingClient.holdTickets(holdDto)
                })

                it('releases the previously held ticketIds', async () => {
                    const holdDto = buildHoldTicketsDto({ ticketIds, customerId: oid(0xc2) })

                    const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                    expect(isHeld).toBe(true)
                })
            })
        })

        describe('when the hold duration has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc1) })
                await fix.ticketHoldingClient.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('returns true for another customer', async () => {
                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        describe('when multiple customers attempt to hold concurrently', () => {
            it(
                'returns true for exactly one customer per showtimeId',
                async () => {
                    const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                    const customerIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))
                    const showtimeIds = Array.from({ length: 100 }, (_, i) => oid(0x1000 + i))

                    const successfulCounts = await Promise.all(
                        showtimeIds.map(async (showtimeId) => {
                            const holdResults = await Promise.all(
                                customerIds.map((customerId) =>
                                    fix.ticketHoldingClient.holdTickets({
                                        customerId,
                                        showtimeId,
                                        ticketIds
                                    })
                                )
                            )

                            const successfulCount = holdResults.filter(Boolean).length
                            return successfulCount
                        })
                    )

                    expect(successfulCounts.every((t) => t === 1)).toBe(true)
                },
                60 * 1000
            )
        })
    })

    describe('searchHeldTicketIds', () => {
        describe('when the tickets are still held', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            it('returns the held ticketIds', async () => {
                const heldTicketIds = await fix.ticketHoldingClient.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.customerId
                )

                expect(heldTicketIds).toEqual(holdDto.ticketIds)
            })
        })

        describe('when the hold duration has expired', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('returns an empty array', async () => {
                const heldTicketIds = await fix.ticketHoldingClient.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.customerId
                )

                expect(heldTicketIds).toHaveLength(0)
            })
        })
    })

    describe('releaseTickets', () => {
        describe('when the customer holds tickets', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            it('returns true for releasing held tickets', async () => {
                const isReleased = await fix.ticketHoldingClient.releaseTickets(
                    holdDto.showtimeId,
                    holdDto.customerId
                )

                expect(isReleased).toBe(true)
            })
        })

        describe('when the customer holds no tickets', () => {
            it('returns true', async () => {
                const isReleased = await fix.ticketHoldingClient.releaseTickets(
                    oid(0xa0),
                    oid(0xc1)
                )

                expect(isReleased).toBe(true)
            })
        })
    })
})
