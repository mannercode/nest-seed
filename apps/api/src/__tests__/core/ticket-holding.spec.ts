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

    describe('purchase claim', () => {
        it('현재 hold owner를 purchase owner로 원자 전환하고 소유자 조건으로 해제한다', async () => {
            const showtimeId = oid(0x10)
            const userId = oid(0xc1)
            const otherUserId = oid(0xc2)
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const tickets = ticketIds.map((id) => ({ id, showtimeId }))
            await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId })

            expect(
                await ticketHoldingService.claimTicketsForPurchase({
                    purchaseRecordId: oid(0xd0),
                    tickets,
                    userId
                })
            ).toBe(true)
            expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, userId)).toEqual([])
            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds,
                    userId: otherUserId
                })
            ).toBe(false)

            await ticketHoldingService.releasePurchaseClaims(oid(0xd0), tickets)

            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds,
                    userId: otherUserId
                })
            ).toBe(true)
        })

        it('일부 티켓만 구매 claim하면 나머지 hold를 원 사용자 목록과 TTL에 유지한다', async () => {
            const showtimeId = oid(0x10)
            const userId = oid(0xc1)
            const otherUserId = oid(0xc2)
            const purchasedTicketId = oid(0xa0)
            const remainingTicketId = oid(0xa1)
            await ticketHoldingService.holdTickets({
                showtimeId,
                ticketIds: [purchasedTicketId, remainingTicketId],
                userId
            })

            expect(
                await ticketHoldingService.claimTicketsForPurchase({
                    purchaseRecordId: oid(0xd0),
                    tickets: [{ id: purchasedTicketId, showtimeId }],
                    userId
                })
            ).toBe(true)

            expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, userId)).toEqual([
                remainingTicketId
            ])
            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds: [remainingTicketId],
                    userId: otherUserId
                })
            ).toBe(false)
        })

        it('hold가 다른 고객에게 넘어갔으면 claim하지 않는다', async () => {
            const showtimeId = oid(0x10)
            const ticketIds = [oid(0xa0)]
            const ownerId = oid(0xc2)
            await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId: ownerId })

            const claimed = await ticketHoldingService.claimTicketsForPurchase({
                purchaseRecordId: oid(0xd0),
                tickets: ticketIds.map((id) => ({ id, showtimeId })),
                userId: oid(0xc1)
            })

            expect(claimed).toBe(false)
            expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, ownerId)).toEqual(
                ticketIds
            )
        })

        it('판매 직전 purchase owner를 확인하고, 다른 고객에게 넘어간 claim은 갱신하지 않는다', async () => {
            const showtimeId = oid(0x10)
            const ticketId = oid(0xa0)
            const purchaseRecordId = oid(0xd0)
            const tickets = [{ id: ticketId, showtimeId }]
            await ticketHoldingService.holdTickets({
                showtimeId,
                ticketIds: [ticketId],
                userId: oid(0xc1)
            })
            await ticketHoldingService.claimTicketsForPurchase({
                purchaseRecordId,
                tickets,
                userId: oid(0xc1)
            })

            expect(
                await ticketHoldingService.confirmPurchaseClaims(purchaseRecordId, tickets)
            ).toBe(true)

            const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
            await cache.delete(`Ticket:{${showtimeId}}:${ticketId}`)
            const otherUserId = oid(0xc2)
            await ticketHoldingService.holdTickets({
                showtimeId,
                ticketIds: [ticketId],
                userId: otherUserId
            })

            expect(
                await ticketHoldingService.confirmPurchaseClaims(purchaseRecordId, tickets)
            ).toBe(false)
            await ticketHoldingService.releasePurchaseClaims(purchaseRecordId, tickets)
            expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, otherUserId)).toEqual(
                [ticketId]
            )
        })

        it('여러 showtime 중 뒤 그룹 claim이 실패하면 앞 그룹 hold와 기존 TTL을 복원한다', async () => {
            const firstShowtimeId = oid(0x10)
            const secondShowtimeId = oid(0x20)
            const firstTicketId = oid(0xa0)
            const secondTicketId = oid(0xa1)
            const userId = oid(0xc1)
            const otherUserId = oid(0xc2)
            await overrideConfigGetter(fix.module, 'ticket', { holdDurationInMs: 10_000 })
            await ticketHoldingService.holdTickets({
                showtimeId: firstShowtimeId,
                ticketIds: [firstTicketId],
                userId
            })
            await ticketHoldingService.holdTickets({
                showtimeId: secondShowtimeId,
                ticketIds: [secondTicketId],
                userId: otherUserId
            })
            const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
            const firstTicketKey = `Ticket:{${firstShowtimeId}}:${firstTicketId}`
            const firstUserKey = `User:{${firstShowtimeId}}:${userId}`
            const readTtl = (key: string) =>
                cache.executeScript<number>(`return redis.call('PTTL', KEYS[1])`, [key], [])
            const ticketTtlBefore = await readTtl(firstTicketKey)
            const userTtlBefore = await readTtl(firstUserKey)

            const claimed = await ticketHoldingService.claimTicketsForPurchase({
                purchaseRecordId: oid(0xd0),
                tickets: [
                    { id: secondTicketId, showtimeId: secondShowtimeId },
                    { id: firstTicketId, showtimeId: firstShowtimeId }
                ],
                userId
            })

            expect(claimed).toBe(false)
            expect(await ticketHoldingService.searchHeldTicketIds(firstShowtimeId, userId)).toEqual(
                [firstTicketId]
            )
            const ticketTtlAfter = await readTtl(firstTicketKey)
            const userTtlAfter = await readTtl(firstUserKey)
            expect(ticketTtlAfter).toBeGreaterThan(0)
            expect(ticketTtlAfter).toBeLessThanOrEqual(ticketTtlBefore)
            expect(userTtlAfter).toBeGreaterThan(0)
            expect(userTtlAfter).toBeLessThanOrEqual(userTtlBefore)
            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId: firstShowtimeId,
                    ticketIds: [firstTicketId],
                    userId: oid(0xc3)
                })
            ).toBe(false)
            expect(
                await ticketHoldingService.searchHeldTicketIds(secondShowtimeId, otherUserId)
            ).toEqual([secondTicketId])
        })

        it('claim 해제는 그 사이 다른 고객이 얻은 hold를 지우지 않는다', async () => {
            const showtimeId = oid(0x10)
            const ticketId = oid(0xa0)
            const purchaseRecordId = oid(0xd0)
            const tickets = [{ id: ticketId, showtimeId }]
            await ticketHoldingService.holdTickets({
                showtimeId,
                ticketIds: [ticketId],
                userId: oid(0xc1)
            })
            await ticketHoldingService.claimTicketsForPurchase({
                purchaseRecordId,
                tickets,
                userId: oid(0xc1)
            })

            const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
            await cache.delete(`Ticket:{${showtimeId}}:${ticketId}`)
            const otherUserId = oid(0xc2)
            await ticketHoldingService.holdTickets({
                showtimeId,
                ticketIds: [ticketId],
                userId: otherUserId
            })

            await ticketHoldingService.releasePurchaseClaims(purchaseRecordId, tickets)

            expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, otherUserId)).toEqual(
                [ticketId]
            )
        })
    })
})
