import { PurchaseRecordDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreatePurchaseRecordDto, createPurchaseRecord, Errors } from '../__helpers__'
import type { PurchaseRecordsFixture } from './purchase-records.fixture'

describe('PurchaseRecordsService', () => {
    let fix: PurchaseRecordsFixture

    beforeEach(async () => {
        const { createPurchaseRecordsFixture } = await import('./purchase-records.fixture')
        fix = await createPurchaseRecordsFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('create', () => {
        it('returns the created purchase record', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const createdPurchaseRecord = await fix.purchaseRecordsService.create(createDto)

            expect(createdPurchaseRecord).toEqual({
                id: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                ...createDto
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        describe('when the purchase record exists', () => {
            let purchase: PurchaseRecordDto

            beforeEach(async () => {
                purchase = await createPurchaseRecord(fix)
            })

            it('returns the purchase record', async () => {
                await fix.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
            })
        })

        describe('when the purchase record does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/purchases/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })
})
