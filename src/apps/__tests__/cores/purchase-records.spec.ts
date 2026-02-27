import type { PurchaseRecordDto } from 'apps/cores'
import {
    buildCreatePurchaseRecordDto,
    createPurchaseRecord,
    Errors
} from 'apps/__tests__/__helpers__'
import { nullObjectId } from 'testlib'
import type { PurchaseRecordsFixture } from './purchase-records.fixture'

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
            const purchaseRecord = await fix.purchaseRecordsClient.create(createDto)

            expect(purchaseRecord).toEqual({
                createdAt: expect.any(Date),
                id: expect.any(String),
                updatedAt: expect.any(Date),
                ...createDto
            })
        })
    })

    describe('GET /purchases/:purchaseRecordId', () => {
        // 구매 기록이 존재할 때
        describe('when the purchase record exists', () => {
            let purchaseRecord: PurchaseRecordDto

            beforeEach(async () => {
                purchaseRecord = await createPurchaseRecord(fix)
            })

            // 구매 기록을 반환한다
            it('returns the purchase record', async () => {
                await fix.httpClient.get(`/purchases/${purchaseRecord.id}`).ok(purchaseRecord)
            })
        })

        // 구매 기록이 존재하지 않을 때
        describe('when the purchase record does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/purchases/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })
})
