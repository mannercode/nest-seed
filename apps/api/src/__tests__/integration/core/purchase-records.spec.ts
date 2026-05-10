import type { PurchaseRecordsService } from 'core'
import { nullObjectId } from '@mannercode/testing'
import {
    buildCreatePurchaseRecordDto,
    createPurchaseRecord,
    Errors,
    type AppTestContext
} from '../helpers'

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

    describe('GET /purchases/:purchaseRecordId', () => {
        it('id에 해당하는 구매 기록을 반환한다', async () => {
            const purchaseRecord = await createPurchaseRecord(fix)

            await fix.httpClient.get(`/purchases/${purchaseRecord.id}`).ok(purchaseRecord)
        })

        it('id에 해당하는 구매 기록이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/purchases/${nullObjectId}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
        })
    })
})
