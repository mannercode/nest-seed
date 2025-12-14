import { HoldTicketsDto } from 'apps/cores'
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

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('holdTickets', () => {
        it('returns true when the tickets are not held', async () => {
            const holdDto = buildHoldTicketsDto({ customerId: oid(0x01) })

            const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

            expect(isHeld).toBe(true)
        })

        describe('고객이 티켓을 hold한 경우', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const customerId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId })
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('returns true for re-holding the same tickets', async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('다른 고객이 선택하면 false 반환', async () => {
                const holdDto = buildHoldTicketsDto({ ticketIds, customerId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            describe('when the customer holds new tickets', () => {
                beforeEach(async () => {
                    const holdDto = buildHoldTicketsDto({
                        ticketIds: [oid(0xb0), oid(0xb1)],
                        customerId
                    })
                    await fix.ticketHoldingService.holdTickets(holdDto)
                })

                it('다른 고객이 이전 티켓을 hold하면 true를 반환한다', async () => {
                    const holdDto = buildHoldTicketsDto({ ticketIds, customerId: oid(0xc2) })

                    const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                    expect(isHeld).toBe(true)
                })
            })
        })

        describe('when the hold duration has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc1) })
                await fix.ticketHoldingService.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('returns true for another customer', async () => {
                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        it(
            'returns true for only one customer when multiple customers attempt to hold concurrently',
            async () => {
                const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                const customerIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))
                const showtimeIds = Array.from({ length: 100 }, (_, i) => oid(0x1000 + i))

                const successfulCounts = await Promise.all(
                    showtimeIds.map(async (showtimeId) => {
                        const holdResults = await Promise.all(
                            customerIds.map((customerId) =>
                                fix.ticketHoldingService.holdTickets({
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

                expect(successfulCounts).toEqual(Array(successfulCounts.length).fill(1))
            },
            60 * 1000
        )
    })

    describe('searchHeldTicketIds', () => {
        describe('when the tickets are still held', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('returns the ticketIds ', async () => {
                const heldTicketIds = await fix.ticketHoldingService.searchHeldTicketIds(
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
                await fix.ticketHoldingService.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('returns an empty array', async () => {
                const heldTicketIds = await fix.ticketHoldingService.searchHeldTicketIds(
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
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('returns true', async () => {
                const isReleased = await fix.ticketHoldingService.releaseTickets(
                    holdDto.showtimeId,
                    holdDto.customerId
                )

                expect(isReleased).toBe(true)
            })
        })

        it('returns true when the customer holds no tickets', async () => {
            const isReleased = await fix.ticketHoldingService.releaseTickets(oid(0xa0), oid(0xc1))

            expect(isReleased).toBe(true)
        })
    })
})
