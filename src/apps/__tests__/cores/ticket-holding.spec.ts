import type { HoldTicketsDto } from 'apps/cores'
import { buildHoldTicketsDto } from 'apps/__tests__/__helpers__'
import { sleep } from 'common'
import { oid, toAny } from 'testlib'
import type { TicketHoldingFixture } from './ticket-holding.fixture'

describe('TicketHoldingService', () => {
    let fix: TicketHoldingFixture

    beforeEach(async () => {
        const { createTicketHoldingFixture } = await import('./ticket-holding.fixture')
        fix = await createTicketHoldingFixture()
    })
    afterEach(() => fix.teardown())

    describe('holdTickets', () => {
        // ticketIds가 보유되지 않았을 때
        describe('when the ticketIds are not held', () => {
            // true를 반환한다
            it('returns true', async () => {
                const holdDto = buildHoldTicketsDto()

                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        // 고객이 이미 티켓을 보유하고 있을 때
        describe('when the customer already holds tickets', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const customerId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ customerId, ticketIds })
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            // 동일한 ticketIds를 다시 보유할 때 true를 반환한다
            it('returns true for re-holding the same ticketIds', async () => {
                const holdDto = buildHoldTicketsDto({ customerId, ticketIds })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            // 다른 고객에 대해 false를 반환한다
            it('returns false for another customer', async () => {
                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc2), ticketIds })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            // 고객이 다른 ticketIds를 보유할 때
            describe('when the customer holds different ticketIds', () => {
                beforeEach(async () => {
                    const holdDto = buildHoldTicketsDto({
                        customerId,
                        ticketIds: [oid(0xb0), oid(0xb1)]
                    })
                    await fix.ticketHoldingClient.holdTickets(holdDto)
                })

                // 이전에 보유한 ticketIds를 해제한다
                it('releases the previously held ticketIds', async () => {
                    const holdDto = buildHoldTicketsDto({ customerId: oid(0xc2), ticketIds })

                    const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                    expect(isHeld).toBe(true)
                })
            })
        })

        // 보유 시간이 만료되었을 때
        describe('when the hold duration has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc1) })
                await fix.ticketHoldingClient.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            // 다른 고객에 대해 true를 반환한다
            it('returns true for another customer', async () => {
                const holdDto = buildHoldTicketsDto({ customerId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingClient.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        // 여러 고객이 동시에 보유를 시도할 때
        describe('when multiple customers attempt to hold concurrently', () => {
            // showtimeId당 정확히 한 명의 고객에 대해 true를 반환한다
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
        // 티켓이 여전히 보유 중일 때
        describe('when the tickets are still held', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            // 보유 중인 ticketIds를 반환한다
            it('returns the held ticketIds', async () => {
                const heldTicketIds = await fix.ticketHoldingClient.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.customerId
                )

                expect(heldTicketIds).toEqual(holdDto.ticketIds)
            })
        })

        // 보유 시간이 만료되었을 때
        describe('when the hold duration has expired', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            // 빈 배열을 반환한다
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
        // 고객이 티켓을 보유하고 있을 때
        describe('when the customer holds tickets', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingClient.holdTickets(holdDto)
            })

            // 보유된 티켓을 해제하면 응답을 반환하지 않는다
            it('returns no response for releasing held tickets', async () => {
                await expect(
                    fix.ticketHoldingClient.releaseTickets(holdDto.showtimeId, holdDto.customerId)
                ).resolves.toBeUndefined()
            })
        })

        // 고객이 보유한 티켓이 없을 때
        describe('when the customer holds no tickets', () => {
            // 응답을 반환하지 않는다
            it('returns no response', async () => {
                await expect(
                    fix.ticketHoldingClient.releaseTickets(oid(0xa0), oid(0xc1))
                ).resolves.toBeUndefined()
            })
        })
    })
})
