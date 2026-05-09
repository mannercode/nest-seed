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
