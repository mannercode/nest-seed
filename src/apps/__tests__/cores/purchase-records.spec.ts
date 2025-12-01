import { nullObjectId } from 'testlib'
import { buildCreatePurchaseRecordDto, Errors } from '../__helpers__'
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
            it('creates and returns a purchase record', async () => {
                const createDto = buildCreatePurchaseRecordDto({})

                const createdPurchaseRecord = await fixture.purchaseRecordsService.create(createDto)

                expect(createdPurchaseRecord).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    ...createDto
                })
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        describe('when the purchase exists', () => {
            it('returns the purchase', async () => {
                await fixture.httpClient
                    .get(`/purchases/${fixture.createdPurchaseRecord.id}`)
                    .ok(fixture.createdPurchaseRecord)
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
