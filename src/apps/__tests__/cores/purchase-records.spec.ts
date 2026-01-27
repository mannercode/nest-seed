import {
    buildCreatePurchaseRecordDto,
    createPurchaseRecord,
    Errors
} from 'apps/__tests__/__helpers__'
import { nullObjectId } from 'testlib'
import type { PurchaseRecordsFixture } from './purchase-records.fixture'
import type { PurchaseRecordDto } from 'apps/cores'

describe('PurchaseRecordsService', () => {
    let fix: PurchaseRecordsFixture

    beforeEach(async () => {
        const { createPurchaseRecordsFixture } = await import('./purchase-records.fixture')
        fix = await createPurchaseRecordsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        // 생성된 구매 기록을 반환한다
        it('returns the created purchase record', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const createdPurchaseRecord = await fix.purchaseRecordsClient.create(createDto)

            expect(createdPurchaseRecord).toEqual({
                id: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                ...createDto
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        // 구매 기록이 존재할 때
        describe('when the purchase record exists', () => {
            let purchase: PurchaseRecordDto

            beforeEach(async () => {
                purchase = await createPurchaseRecord(fix)
            })

            // 구매 기록을 반환한다
            it('returns the purchase record', async () => {
                await fix.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
            })
        })

        // 구매 기록이 존재하지 않을 때
        describe('when the purchase record does not exist', () => {
            // 404 Not Found를 반환한다
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
