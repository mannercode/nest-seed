import type { TicketHoldingService } from 'core'
import { CacheService, ensure, sleep } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { buildHoldTicketsDto, overrideConfigGetter, type AppTestContext } from '../helpers'

describe('TicketHoldingService', () => {
    let fix: AppTestContext
    let ticketHoldingService: TicketHoldingService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { TicketHoldingService } = await import('core')
        fix = await createAppTestContext()
        ticketHoldingService = fix.module.get(TicketHoldingService)
    })
    afterEach(() => fix.teardown())

    describe('holdTickets', () => {
        it('아무도 보유하지 않은 티켓을 잡으면 true를 반환한다', async () => {
            const holdDto = buildHoldTicketsDto()

            const isHeld = await ticketHoldingService.holdTickets(holdDto)

            expect(isHeld).toBe(true)
        })

        describe('고객이 이미 티켓을 보유하고 있을 때', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const userId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                await ticketHoldingService.holdTickets(holdDto)
            })

            it('같은 고객이 같은 티켓을 다시 잡으면 true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('다른 고객이 같은 티켓을 잡으려 하면 false를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            it('같은 고객이 다른 티켓을 잡으면 이전 보유를 해제한다', async () => {
                const newHoldDto = buildHoldTicketsDto({
                    userId,
                    ticketIds: [oid(0xb0), oid(0xb1)]
                })
                await ticketHoldingService.holdTickets(newHoldDto)

                // 이전에 선점되어 있던 티켓을 다른 고객이 새로 선점할 수 있어야 한다.
                const otherHold = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(otherHold)

                expect(isHeld).toBe(true)
            })

            it('이전 보유 목록의 티켓이 그새 다른 고객 소유가 됐으면 해제하지 않는다', async () => {
                const { showtimeId } = buildHoldTicketsDto()
                const lostTicketId = ensure(ticketIds[0])
                const ownedTicketId = ensure(ticketIds[1])

                // TTL 만료 시차로 티켓 키만 먼저 사라진 상태를 키 삭제로 재현한다(sleep 불필요).
                const cacheService = fix.module.get<CacheService>(
                    CacheService.getName('ticket-holding')
                )
                await cacheService.delete(`Ticket:{${showtimeId}}:${lostTicketId}`)

                const otherHold = buildHoldTicketsDto({
                    userId: oid(0xc2),
                    ticketIds: [lostTicketId]
                })
                expect(await ticketHoldingService.holdTickets(otherHold)).toBe(true)

                // 기존 고객이 갱신해도 이전 목록 중 본인 소유로 확인된 티켓만 해제해야 한다.
                const renewHold = buildHoldTicketsDto({ userId, ticketIds: [oid(0xb0)] })
                await ticketHoldingService.holdTickets(renewHold)

                const thirdUserId = oid(0xc3)
                const holdLost = buildHoldTicketsDto({
                    userId: thirdUserId,
                    ticketIds: [lostTicketId]
                })
                expect(await ticketHoldingService.holdTickets(holdLost)).toBe(false)

                const holdOwned = buildHoldTicketsDto({
                    userId: thirdUserId,
                    ticketIds: [ownedTicketId]
                })
                expect(await ticketHoldingService.holdTickets(holdOwned)).toBe(true)
            })
        })

        it('보유 시간이 만료되면 다른 고객이 같은 티켓을 잡을 수 있다', async () => {
            await overrideConfigGetter(fix.module, 'ticket', { holdDurationInMs: 1000 })

            const holdDto = buildHoldTicketsDto({ userId: oid(0xc1) })
            await ticketHoldingService.holdTickets(holdDto)

            await sleep(1000 + 500)

            const otherHold = buildHoldTicketsDto({ userId: oid(0xc2) })
            const isHeld = await ticketHoldingService.holdTickets(otherHold)

            expect(isHeld).toBe(true)
        })

        it(
            '여러 고객이 동시에 보유를 시도하면 상영 한 건당 한 명만 성공한다',
            async () => {
                const ticketIds = Array.from({ length: 5 }, (_, i) => oid(0x2000 + i))
                const userIds = Array.from({ length: 10 }, (_, i) => oid(0x3000 + i))
                const showtimeIds = Array.from({ length: 100 }, (_, i) => oid(0x1000 + i))

                const successfulCounts = await Promise.all(
                    showtimeIds.map(async (showtimeId) => {
                        const holdResults = await Promise.all(
                            userIds.map((userId) =>
                                ticketHoldingService.holdTickets({ userId, showtimeId, ticketIds })
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

    describe('searchHeldTicketIds', () => {
        it('보유 중이면 잡아 둔 티켓 ID를 반환한다', async () => {
            const holdDto = buildHoldTicketsDto()
            await ticketHoldingService.holdTickets(holdDto)

            const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                holdDto.showtimeId,
                holdDto.userId
            )

            expect(heldTicketIds).toEqual(holdDto.ticketIds)
        })

        it('보유 시간이 만료되면 빈 배열을 반환한다', async () => {
            await overrideConfigGetter(fix.module, 'ticket', { holdDurationInMs: 1000 })

            const holdDto = buildHoldTicketsDto()
            await ticketHoldingService.holdTickets(holdDto)

            await sleep(1000 + 500)

            const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                holdDto.showtimeId,
                holdDto.userId
            )

            expect(heldTicketIds).toHaveLength(0)
        })
    })
})
