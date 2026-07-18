import type { PurchaseRecordsService } from 'core'
import { pickIds, sleep } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { buildCreatePurchaseRecordDto, createPurchaseRecord, type AppTestContext } from '../helpers'

describe('PurchaseRecordsService', () => {
    let fix: AppTestContext
    let purchaseRecordsService: PurchaseRecordsService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { PurchaseRecordsService } = await import('core')
        fix = await createAppTestContext()
        purchaseRecordsService = fix.module.get(PurchaseRecordsService)
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        it('생성된 구매 기록을 반환한다', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const purchaseRecord = await purchaseRecordsService.create(createDto)

            expect(purchaseRecord).toEqual({
                createdAt: expect.any(Date),
                id: expect.any(String),
                updatedAt: expect.any(Date),
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
})
