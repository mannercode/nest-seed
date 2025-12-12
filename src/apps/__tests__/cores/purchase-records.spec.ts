import { PurchaseRecordDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreatePurchaseRecordDto, createPurchaseRecord, Errors } from '../__helpers__'
import type { PurchaseRecordsFixture } from './purchase-records.fixture'

describe('PurchaseRecordsService', () => {
    let fixture: PurchaseRecordsFixture

    beforeEach(async () => {
        const { createPurchaseRecordsFixture } = await import('./purchase-records.fixture')
        fixture = await createPurchaseRecordsFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        describe('when the payload is valid', () => {
            const payload = buildCreatePurchaseRecordDto()

            it('returns the created purchase record', async () => {
                const createdPurchaseRecord = await fixture.purchaseRecordsService.create(payload)
                expect(createdPurchaseRecord).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    ...payload
                })
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        describe('when the purchase exists', () => {
            let purchase: PurchaseRecordDto

            beforeEach(async () => {
                purchase = await createPurchaseRecord(fixture)
            })

            it('returns 200 with the purchase', async () => {
                await fixture.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
            })
        })

        describe('when the purchase does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .get(`/purchases/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })
})
