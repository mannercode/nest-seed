import type { HoldTicketsDto, TicketHoldingService } from 'core'
import { sleep } from '@mannercode/common'
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
        it('아무도 보유하지 않은 ticketIds를 보유하면 true를 반환한다', async () => {
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

            it('동일한 고객이 같은 ticketIds를 다시 보유하면 true를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId, ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(true)
            })

            it('다른 고객이 같은 ticketIds를 보유하려 하면 false를 반환한다', async () => {
                const holdDto = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(holdDto)

                expect(isHeld).toBe(false)
            })

            it('같은 고객이 다른 ticketIds를 보유하면 이전 보유는 해제된다', async () => {
                const newHoldDto = buildHoldTicketsDto({
                    userId,
                    ticketIds: [oid(0xb0), oid(0xb1)]
                })
                await ticketHoldingService.holdTickets(newHoldDto)

                // 다른 고객이 이전에 보유됐던 ticketIds를 잡을 수 있어야 한다.
                const otherHold = buildHoldTicketsDto({ userId: oid(0xc2), ticketIds })
                const isHeld = await ticketHoldingService.holdTickets(otherHold)

                expect(isHeld).toBe(true)
            })
        })

        it('보유 시간이 만료되면 다른 고객이 같은 ticketIds를 보유할 수 있다', async () => {
            await overrideConfigGetter(fix.module, 'ticket', { holdDurationInMs: 1000 })

            const holdDto = buildHoldTicketsDto({ userId: oid(0xc1) })
            await ticketHoldingService.holdTickets(holdDto)

            await sleep(1000 + 500)

            const otherHold = buildHoldTicketsDto({ userId: oid(0xc2) })
            const isHeld = await ticketHoldingService.holdTickets(otherHold)

            expect(isHeld).toBe(true)
        })

        it(
            '여러 고객이 동시에 보유를 시도하면 showtimeId당 한 명만 성공한다',
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
        it('보유 중이면 보유한 ticketIds를 반환한다', async () => {
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

    describe('releaseTickets', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let holdDto: HoldTicketsDto

            beforeEach(async () => {
                holdDto = buildHoldTicketsDto()
                await ticketHoldingService.holdTickets(holdDto)
            })

            it('보유 상태가 사라진다', async () => {
                await ticketHoldingService.releaseTickets(holdDto.showtimeId, holdDto.userId)

                const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                    holdDto.showtimeId,
                    holdDto.userId
                )
                expect(heldTicketIds).toHaveLength(0)
            })

            it('해제 후 다른 고객이 같은 ticketIds를 보유할 수 있다', async () => {
                await ticketHoldingService.releaseTickets(holdDto.showtimeId, holdDto.userId)

                const otherDto = buildHoldTicketsDto({
                    showtimeId: holdDto.showtimeId,
                    ticketIds: holdDto.ticketIds,
                    userId: oid(0xff)
                })
                const isHeld = await ticketHoldingService.holdTickets(otherDto)

                expect(isHeld).toBe(true)
            })
        })

        it('보유한 티켓이 없는 고객에게 호출해도 멱등하게 동작한다', async () => {
            await expect(
                ticketHoldingService.releaseTickets(oid(0xa0), oid(0xc1))
            ).resolves.toBeUndefined()
        })

        it('일부 티켓 키 삭제가 실패해도 경고 로그만 남기고 계속 진행한다', async () => {
            const holdDto = buildHoldTicketsDto()
            await ticketHoldingService.holdTickets(holdDto)

            const cacheService = (ticketHoldingService as any).cacheService
            const realDelete = cacheService.delete.bind(cacheService)
            let calls = 0
            jest.spyOn(cacheService, 'delete').mockImplementation((key: any) => {
                calls++
                // 첫 호출(티켓 키 하나) 실패, 나머지(다른 티켓 + user 키)는 정상.
                if (calls === 1) return Promise.reject(new Error('delete failed'))
                return realDelete(key)
            })
            const { Logger } = await import('@nestjs/common')
            const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()

            await expect(
                ticketHoldingService.releaseTickets(holdDto.showtimeId, holdDto.userId)
            ).resolves.toBeUndefined()

            expect(warnSpy).toHaveBeenCalledWith(
                'partial ticket release failure',
                expect.objectContaining({ failedCount: 1 })
            )
        })
    })
})
