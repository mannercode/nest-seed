import { CacheService, ensure, sleep } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { TicketHoldingService } from '#core'
import {
    buildHoldTicketsDto,
    overrideConfigGetter,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

describe('TicketHoldingService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let ticketHoldingService: TicketHoldingService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        ticketHoldingService = fix.module.get(TicketHoldingService)
    })
    afterEach(() => teardown?.())

    describe('holdTickets', () => {
        it('아무도 선점하지 않은 티켓을 선점하면 true를 반환한다', async () => {
            const holdDto = buildHoldTicketsDto()

            const isHeld = await ticketHoldingService.holdTickets(holdDto)

            expect(isHeld).toBe(true)
        })

        describe('사용자가 이미 티켓을 선점하고 있을 때', () => {
            const ticketIds = [oid(0xa0), oid(0xa1)]
            const userId = oid(0xc1)

            beforeEach(async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                await ticketHoldingService.holdTickets(holdDto)
            })

            it('같은 사용자가 같은 티켓을 다시 선점하면 true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('다른 사용자가 같은 티켓을 선점하려 하면 false를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            it('같은 사용자가 다른 티켓을 선점하면 이전 선점을 해제한다', async () => {
                const newHoldDto = buildHoldTicketsDto({
                    userId,
                    ticketIds: [oid(0xb0), oid(0xb1)]
                })
                await ticketHoldingService.holdTickets(newHoldDto)

                // 이전에 선점되어 있던 티켓을 다른 사용자가 새로 선점할 수 있어야 한다.
                const otherHold = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(otherHold)

                expect(isHeld).toBe(true)
            })

            describe('기존 선점 목록의 일부 티켓을 다른 사용자가 선점했으면', () => {
                let lostTicketId: string
                let ownedTicketId: string
                beforeEach(async () => {
                    const { showtimeId } = buildHoldTicketsDto()
                    lostTicketId = ensure(ticketIds[0])
                    ownedTicketId = ensure(ticketIds[1])

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
                })
                it('선점 목록을 바꿀 때 자신이 선점한 티켓만 해제한다', async () => {
                    // 기존 사용자가 갱신해도 이전 목록 중 본인 소유로 확인된 티켓만 해제해야 한다.
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
        })

        it(
            '여러 사용자가 동시에 선점을 시도하면 상영 한 건당 한 명만 성공한다',
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
        describe('사용자가 선점한 티켓이 존재하면', () => {
            let holdDto: ReturnType<typeof buildHoldTicketsDto>
            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await ticketHoldingService.holdTickets(holdDto)
            })
            it('그 사용자의 선점 티켓 ID를 반환한다', async () => {
                const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.userId
                )

                expect(heldTicketIds).toEqual(holdDto.ticketIds)
            })
        })
    })

    describe('선점 시간이 만료되면', () => {
        let holdDto: ReturnType<typeof buildHoldTicketsDto>

        beforeEach(async () => {
            await overrideConfigGetter(fix.module, 'ticket', { holdDurationInMs: 1000 })
            holdDto = buildHoldTicketsDto({ userId: oid(0xc1) })
            await ticketHoldingService.holdTickets(holdDto)
            await sleep(1000 + 500)
        })

        it('빈 선점 목록을 반환한다', async () => {
            const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                holdDto.showtimeId,
                holdDto.userId
            )

            expect(heldTicketIds).toHaveLength(0)
        })

        it('다른 사용자가 같은 티켓을 선점할 수 있다', async () => {
            const isHeld = await ticketHoldingService.holdTickets({ ...holdDto, userId: oid(0xc2) })

            expect(isHeld).toBe(true)
        })
    })

    describe('claimTicketsForPurchase, confirmPurchaseClaims, releasePurchaseClaims', () => {
        describe('한 사용자 ID로 선점된 티켓이 존재하면', () => {
            let showtimeId: string
            let ticketIds: string[]
            let ownerId: string
            beforeEach(async () => {
                showtimeId = oid(0x10)
                ticketIds = [oid(0xa0)]
                ownerId = oid(0xc2)
                await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId: ownerId })
            })
            it('다른 사용자 ID로 구매 할당을 요청하면 false를 반환하고 기존 선점을 유지한다', async () => {
                const claimed = await ticketHoldingService.claimTicketsForPurchase({
                    purchaseRecordId: oid(0xd0),
                    showtimeId,
                    ticketIds,
                    userId: oid(0xc1)
                })

                expect(claimed).toBe(false)
                expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, ownerId)).toEqual(
                    ticketIds
                )
            })
        })

        describe('사용자가 두 티켓을 선점했으면', () => {
            const showtimeId = oid(0x10)
            const userId = oid(0xc1)
            const otherUserId = oid(0xc2)
            const purchasedTicketId = oid(0xa0)
            const remainingTicketId = oid(0xa1)
            const ticketIds = [purchasedTicketId, remainingTicketId]
            beforeEach(async () => {
                await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId })
            })
            it('두 티켓을 구매에 할당하면 사용자 선점 목록에서 제외하고 다른 사용자의 선점을 거절한다', async () => {
                expect(
                    await ticketHoldingService.claimTicketsForPurchase({
                        purchaseRecordId: oid(0xd0),
                        showtimeId,
                        ticketIds,
                        userId
                    })
                ).toBe(true)
                expect(await ticketHoldingService.searchHeldTicketIds(showtimeId, userId)).toEqual(
                    []
                )
                expect(
                    await ticketHoldingService.holdTickets({
                        showtimeId,
                        ticketIds,
                        userId: otherUserId
                    })
                ).toBe(false)
            })
            it('일부 티켓을 구매에 할당해도 나머지는 기존 사용자의 선점 목록에 남는다', async () => {
                expect(
                    await ticketHoldingService.claimTicketsForPurchase({
                        purchaseRecordId: oid(0xd0),
                        showtimeId,
                        ticketIds: [purchasedTicketId],
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
        })
        describe('구매에 할당된 두 티켓이 존재하면', () => {
            const showtimeId = oid(0x10)
            const userId = oid(0xc1)
            const otherUserId = oid(0xc2)
            const purchasedTicketId = oid(0xa0)
            const remainingTicketId = oid(0xa1)
            const ticketIds = [purchasedTicketId, remainingTicketId]
            beforeEach(async () => {
                await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId })
                expect(
                    await ticketHoldingService.claimTicketsForPurchase({
                        purchaseRecordId: oid(0xd0),
                        showtimeId,
                        ticketIds,
                        userId
                    })
                ).toBe(true)
            })
            it('할당을 해제하면 다른 사용자가 두 티켓을 선점할 수 있다', async () => {
                await ticketHoldingService.releasePurchaseClaims({
                    purchaseRecordId: oid(0xd0),
                    showtimeId,
                    ticketIds
                })

                expect(
                    await ticketHoldingService.holdTickets({
                        showtimeId,
                        ticketIds,
                        userId: otherUserId
                    })
                ).toBe(true)
            })
        })

        describe('구매에 할당했던 티켓을 다른 사용자가 선점했으면', () => {
            const showtimeId = oid(0x10)
            const ticketId = oid(0xa0)
            const purchaseRecordId = oid(0xd0)
            const ticketIds = [ticketId]
            const otherUserId = oid(0xc2)
            beforeEach(async () => {
                await ticketHoldingService.holdTickets({ showtimeId, ticketIds, userId: oid(0xc1) })
                await ticketHoldingService.claimTicketsForPurchase({
                    purchaseRecordId,
                    showtimeId,
                    ticketIds,
                    userId: oid(0xc1)
                })
                expect(
                    await ticketHoldingService.confirmPurchaseClaims({
                        purchaseRecordId,
                        showtimeId,
                        ticketIds
                    })
                ).toBe(true)
                const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
                await cache.delete(`Ticket:{${showtimeId}}:${ticketId}`)
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds,
                    userId: otherUserId
                })
            })
            it('기존 구매의 선점 갱신을 거절하고 새 사용자의 선점을 유지한다', async () => {
                expect(
                    await ticketHoldingService.confirmPurchaseClaims({
                        purchaseRecordId,
                        showtimeId,
                        ticketIds
                    })
                ).toBe(false)
                expect(
                    await ticketHoldingService.searchHeldTicketIds(showtimeId, otherUserId)
                ).toEqual([ticketId])
            })
            it('기존 구매의 할당을 해제해도 새 사용자의 선점을 유지한다', async () => {
                await ticketHoldingService.releasePurchaseClaims({
                    purchaseRecordId,
                    showtimeId,
                    ticketIds
                })
                expect(
                    await ticketHoldingService.searchHeldTicketIds(showtimeId, otherUserId)
                ).toEqual([ticketId])
            })
        })
    })
})
