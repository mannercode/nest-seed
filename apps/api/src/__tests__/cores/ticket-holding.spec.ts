import type { HoldTicketsDto } from 'cores'
import { sleep } from '@mannercode/common'
import { oid, toAny } from '@mannercode/testing'
import type { TicketHoldingFixture } from './ticket-holding.fixture'
import { buildHoldTicketsDto } from '../__helpers__'

describe('TicketHoldingService', () => {
    let fix: TicketHoldingFixture

    beforeEach(async () => {
        const { createTicketHoldingFixture } = await import('./ticket-holding.fixture')
        fix = await createTicketHoldingFixture()
    })
    afterEach(() => fix.teardown())

    describe('holdTickets', () => {
        describe('ticketIds가 보유되지 않았을 때', () => {
            it('true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto()

                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        describe('고객이 이미 티켓을 보유하고 있을 때', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const userId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('동일한 ticketIds를 다시 보유할 때 true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('다른 고객에 대해 false를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            describe('고객이 다른 ticketIds를 보유할 때', () => {
                beforeEach(async () => {
                    const holdDto = buildHoldTicketsDto({
                        userId,
                        ticketIds: [oid(0xb0), oid(0xb1)]
                    })
                    await fix.ticketHoldingService.holdTickets(holdDto)
                })

                it('이전에 보유한 ticketIds를 해제한다', async () => {
                    const holdDto = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })

                    const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                    expect(isHeld).toBe(true)
                })
            })
        })

        describe('보유 시간이 만료되었을 때', () => {
            beforeEach(async () => {
                const { Rules } = await import('config')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                const holdDto = buildHoldTicketsDto({ userId: oid(0xc1) })
                await fix.ticketHoldingService.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('다른 고객에 대해 true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId: oid(0xc2) })
                const isHeld = await fix.ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })
        })

        describe('여러 고객이 동시에 보유를 시도할 때', () => {
            it(
                'showtimeId당 정확히 한 명의 고객에 대해 true를 반환한다',
                async () => {
                    const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                    const userIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))
                    const showtimeIds = Array.from({ length: 100 }, (_, i) => oid(0x1000 + i))

                    const successfulCounts = await Promise.all(
                        showtimeIds.map(async (showtimeId) => {
                            const holdResults = await Promise.all(
                                userIds.map((userId) =>
                                    fix.ticketHoldingService.holdTickets({
                                        userId,
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
        describe('티켓이 여전히 보유 중일 때', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('보유 중인 ticketIds를 반환한다', async () => {
                const heldTicketIds = await fix.ticketHoldingService.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.userId
                )

                expect(heldTicketIds).toEqual(holdDto.ticketIds)
            })
        })

        describe('보유 시간이 만료되었을 때', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                const { Rules } = await import('config')
                toAny(Rules).Ticket.holdDurationInMs = 1000

                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingService.holdTickets(holdDto)

                await sleep(1000 + 500)
            })

            it('빈 배열을 반환한다', async () => {
                const heldTicketIds = await fix.ticketHoldingService.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.userId
                )

                expect(heldTicketIds).toHaveLength(0)
            })
        })
    })

    describe('releaseTickets', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await fix.ticketHoldingService.holdTickets(holdDto)
            })

            it('보유 상태가 사라진다', async () => {
                await fix.ticketHoldingService.releaseTickets(holdDto.showtimeId, holdDto.userId)

                const heldTicketIds = await fix.ticketHoldingService.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.userId
                )
                expect(heldTicketIds).toHaveLength(0)
            })

            it('다른 고객이 같은 ticketIds 를 다시 보유할 수 있다', async () => {
                await fix.ticketHoldingService.releaseTickets(holdDto.showtimeId, holdDto.userId)

                const otherDto = buildHoldTicketsDto({
                    showtimeId: holdDto.showtimeId,
                    ticketIds: holdDto.ticketIds,
                    userId: oid(0xff)
                })
                const isHeld = await fix.ticketHoldingService.holdTickets(otherDto)

                expect(isHeld).toBe(true)
            })
        })

        describe('고객이 보유한 티켓이 없을 때', () => {
            it('멱등하게 동작한다 (예외 없이 반환)', async () => {
                await expect(
                    fix.ticketHoldingService.releaseTickets(oid(0xa0), oid(0xc1))
                ).resolves.toBeUndefined()
            })
        })
    })
})
