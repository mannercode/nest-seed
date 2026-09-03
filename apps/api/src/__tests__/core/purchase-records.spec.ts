import { DateUtil, ensure, pickIds, sleep } from '@mannercode/common'
import { instant, oid } from '@mannercode/testing'
import { PurchaseRecordsService } from '#core'
import {
    buildCreatePurchaseRecordDto,
    createPurchaseRecord,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

describe('PurchaseRecordsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let purchaseRecordsService: PurchaseRecordsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        purchaseRecordsService = fix.module.get(PurchaseRecordsService)
    })
    afterEach(() => teardown?.())

    describe('create', () => {
        it('생성된 구매 기록을 반환한다', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const purchaseRecord = await purchaseRecordsService.create(createDto)

            expect(purchaseRecord).toEqual({
                createdAt: expect.any(Temporal.Instant),
                id: expect.any(String),
                updatedAt: expect.any(Temporal.Instant),
                ...createDto
            })
        })
    })

    describe('findByUserId', () => {
        it('해당 userId의 구매 기록만 반환한다', async () => {
            const userId = oid(0x1)
            const mine1 = await createPurchaseRecord(fix, { userId })
            const mine2 = await createPurchaseRecord(fix, { userId })
            await createPurchaseRecord(fix, { userId: oid(0x2) })

            const records = await purchaseRecordsService.findByUserId(userId)

            expect(records).toEqual(expect.arrayContaining([mine1, mine2]))
            expect(records).toHaveLength(2)
            expect(records.every((record) => record.userId === userId)).toBe(true)
        })

        it('구매 기록이 없으면 빈 배열을 반환한다', async () => {
            const records = await purchaseRecordsService.findByUserId(oid(0x1))

            expect(records).toEqual([])
        })

        it('구매 기록을 최신 구매가 먼저 오도록 정렬해 반환한다', async () => {
            const userId = oid(0x1)
            const first = await createPurchaseRecord(fix, { userId })
            // createdAt이 ms 단위에서 동률이 되지 않도록 두 생성 사이를 벌린다.
            await sleep(50)
            const second = await createPurchaseRecord(fix, { userId })

            const records = await purchaseRecordsService.findByUserId(userId)

            expect(pickIds(records)).toEqual([second.id, first.id])
        })
    })

    describe('durable purchase state', () => {
        it('pending은 고객 이력에서 숨기고 완료 전이 뒤 durable event로 조회한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const pending = await purchaseRecordsService.create(createDto, { pending: true })

            expect(await purchaseRecordsService.findByUserId(createDto.userId)).toEqual([])
            expect(await purchaseRecordsService.findPendingById(pending.id)).toEqual(pending)
            expect(
                await purchaseRecordsService.findPendingBefore(
                    DateUtil.add({ milliseconds: -1000 })
                )
            ).toEqual([])
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([pending])

            const paymentId = oid(0x99)
            await purchaseRecordsService.setPaymentId(pending.id, paymentId)
            const completionId = 'completion-1'
            await purchaseRecordsService.claimForCompletion(
                pending.id,
                completionId,
                DateUtil.add({ minutes: 1 })
            )
            const completed = await purchaseRecordsService.markCompleted(pending.id, completionId)

            expect(completed.paymentId).toBe(paymentId)
            expect(await purchaseRecordsService.findPendingById(pending.id)).toBeUndefined()
            expect(await purchaseRecordsService.findByUserId(createDto.userId)).toEqual([completed])
            expect(
                await purchaseRecordsService.findUnpublishedBefore(
                    DateUtil.add({ milliseconds: 1000 })
                )
            ).toEqual([completed])

            const publicationId = 'publication-1'
            const publicationNow = DateUtil.now()
            const publicationLeaseUntil = DateUtil.add({ base: publicationNow, minutes: 1 })
            const publicationBefore = DateUtil.add({ milliseconds: 1000 })
            expect(
                await purchaseRecordsService.claimEventPublication(pending.id, {
                    before: publicationBefore,
                    leaseUntil: publicationLeaseUntil,
                    now: publicationNow,
                    publicationId
                })
            ).toEqual(expect.objectContaining({ id: pending.id }))
            expect(
                await purchaseRecordsService.claimEventPublication(pending.id, {
                    before: publicationBefore,
                    leaseUntil: publicationLeaseUntil,
                    now: publicationNow,
                    publicationId: 'publication-loser'
                })
            ).toBeUndefined()

            const takeoverId = 'publication-after-lease'
            const takeoverNow = DateUtil.add({ base: publicationLeaseUntil, milliseconds: 1 })
            expect(
                await purchaseRecordsService.claimEventPublication(pending.id, {
                    before: publicationBefore,
                    leaseUntil: DateUtil.add({ base: takeoverNow, minutes: 1 }),
                    now: takeoverNow,
                    publicationId: takeoverId
                })
            ).toEqual(expect.objectContaining({ id: pending.id }))
            expect(await purchaseRecordsService.markEventPublished(pending.id, publicationId)).toBe(
                false
            )
            expect(await purchaseRecordsService.markEventPublished(pending.id, takeoverId)).toBe(
                true
            )

            expect(
                await purchaseRecordsService.findUnpublishedBefore(
                    DateUtil.add({ milliseconds: 1000 })
                )
            ).toEqual([])
        })

        it('completion lease는 pending 상태에서 한 번만 획득한다', async () => {
            const pending = await purchaseRecordsService.create(
                buildCreatePurchaseRecordDto({ paymentId: null }),
                { pending: true }
            )
            await purchaseRecordsService.claimForCompletion(
                pending.id,
                'completion-winner',
                DateUtil.add({ minutes: 1 })
            )

            await expect(
                purchaseRecordsService.claimForCompletion(
                    pending.id,
                    'completion-loser',
                    DateUtil.add({ minutes: 1 })
                )
            ).rejects.toThrow(`Purchase record is no longer pending: ${pending.id}`)
        })

        it('보상 완료 상태는 pending 재시도와 고객 구매 이력에서 제외한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const pending = await purchaseRecordsService.create(createDto, { pending: true })
            const reconciliationId = 'reconciliation-1'
            await purchaseRecordsService.claimForReconciliation(pending.id, {
                before: DateUtil.add({ milliseconds: 1000 }),
                leaseUntil: DateUtil.add({ minutes: 1 }),
                now: DateUtil.now(),
                reconciliationId
            })

            await purchaseRecordsService.markCancelled(pending.id, reconciliationId)

            expect(await purchaseRecordsService.findPendingById(pending.id)).toBeUndefined()
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([])
            expect(await purchaseRecordsService.findByUserId(createDto.userId)).toEqual([])
        })

        it('여러 replica 중 한 곳만 보상 lease를 얻고 실패한 lease는 재시도한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const pending = await purchaseRecordsService.create(createDto, { pending: true })
            const now = DateUtil.now()
            const before = DateUtil.add({ base: now, milliseconds: 1000 })
            const leaseUntil = DateUtil.add({ base: now, minutes: 1 })

            const claims = await Promise.all(
                ['reconciliation-1', 'reconciliation-2'].map((reconciliationId) =>
                    purchaseRecordsService.claimForReconciliation(pending.id, {
                        before,
                        leaseUntil,
                        now,
                        reconciliationId
                    })
                )
            )
            const winnerIndex = claims.findIndex(Boolean)
            expect(claims.filter(Boolean)).toHaveLength(1)
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([])
            await expect(
                purchaseRecordsService.markCompleted(pending.id, 'completion-loser')
            ).rejects.toThrow('Purchase completion lease was lost')

            const winnerId = ensure(['reconciliation-1', 'reconciliation-2'][winnerIndex])
            const takeoverNow = DateUtil.add({ base: leaseUntil, milliseconds: 1 })
            const takeoverId = 'reconciliation-after-crash'
            expect(
                await purchaseRecordsService.claimForReconciliation(pending.id, {
                    before,
                    leaseUntil: DateUtil.add({ base: takeoverNow, minutes: 1 }),
                    now: takeoverNow,
                    reconciliationId: takeoverId
                })
            ).toEqual(expect.objectContaining({ id: pending.id }))

            // 만료된 이전 owner는 새 lease의 상태를 완료하거나 해제할 수 없다.
            await purchaseRecordsService.markCancelled(pending.id, winnerId)
            await purchaseRecordsService.releaseReconciliationClaim(pending.id, winnerId)
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([])

            await purchaseRecordsService.releaseReconciliationClaim(pending.id, takeoverId)
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([expect.objectContaining({ id: pending.id })])

            const retryId = 'reconciliation-retry'
            expect(
                await purchaseRecordsService.claimForReconciliation(pending.id, {
                    before,
                    leaseUntil,
                    now: DateUtil.now(),
                    reconciliationId: retryId
                })
            ).toEqual(expect.objectContaining({ id: pending.id }))
            await purchaseRecordsService.markCancelled(pending.id, retryId)
            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([])
        })

        it('프로세스가 죽어 만료된 completion lease를 보상 replica가 회수한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const pending = await purchaseRecordsService.create(createDto, { pending: true })
            const completionId = 'completion-crashed'
            await purchaseRecordsService.claimForCompletion(pending.id, completionId, instant())

            expect(
                await purchaseRecordsService.findPendingBefore(DateUtil.add({ milliseconds: 1000 }))
            ).toEqual([expect.objectContaining({ id: pending.id })])

            const reconciliationId = 'reconciliation-recovery'
            expect(
                await purchaseRecordsService.claimForReconciliation(pending.id, {
                    before: DateUtil.add({ milliseconds: 1000 }),
                    leaseUntil: DateUtil.add({ minutes: 1 }),
                    now: DateUtil.now(),
                    reconciliationId
                })
            ).toEqual(expect.objectContaining({ id: pending.id }))
            await expect(
                purchaseRecordsService.markCompleted(pending.id, completionId)
            ).rejects.toThrow('Purchase completion lease was lost')

            await purchaseRecordsService.markCancelled(pending.id, reconciliationId)
            expect(await purchaseRecordsService.findByUserId(createDto.userId)).toEqual([])
        })
    })
})
