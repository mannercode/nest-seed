import type { PurchaseRecordDto } from 'core'
import { nullObjectId } from '@mannercode/testing'
import type { PurchaseRecordsFixture } from './purchase-records.fixture'
import { buildCreatePurchaseRecordDto, createPurchaseRecord, Errors } from '../helpers'

describe('PurchaseRecordsService', () => {
    let fix: PurchaseRecordsFixture

    beforeEach(async () => {
        const { createPurchaseRecordsFixture } = await import('./purchase-records.fixture')
        fix = await createPurchaseRecordsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        it('생성된 구매 기록을 반환한다', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const purchaseRecord = await fix.purchaseRecordsService.create(createDto)

            expect(purchaseRecord).toEqual({
                createdAt: expect.any(Date),
                id: expect.any(String),
                updatedAt: expect.any(Date),
                ...createDto
            })
        })
    })

    describe('GET /purchases/:purchaseRecordId', () => {
        describe('구매 기록이 존재할 때', () => {
            let purchaseRecord: PurchaseRecordDto

            beforeEach(async () => {
                purchaseRecord = await createPurchaseRecord(fix)
            })

            it('구매 기록을 반환한다', async () => {
                await fix.httpClient.get(`/purchases/${purchaseRecord.id}`).ok(purchaseRecord)
            })
        })

        describe('구매 기록이 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .get(`/purchases/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })
})
