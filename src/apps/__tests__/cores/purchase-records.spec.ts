import { nullObjectId } from 'testlib'
import { buildCreatePurchaseRecordDto, Errors } from '../__helpers__'
import { Fixture } from './purchase-records.fixture'

describe('PurchaseRecordsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./purchase-records.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createPurchaseRecord', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 구매 기록을 생성하고 반환한다
            it('creates and returns a purchase record', async () => {
                const createDto = buildCreatePurchaseRecordDto({})

                const createdPurchaseRecord =
                    await fix.purchaseRecordsService.createPurchaseRecord(createDto)

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
        // 구매 정보가 존재하는 경우
        describe('when purchase exists', () => {
            // 구매 정보를 반환한다.
            it('returns the purchase', async () => {
                await fix.httpClient
                    .get(`/purchases/${fix.createdPurchaseRecord.id}`)
                    .ok(fix.createdPurchaseRecord)
            })
        })

        // 구매 정보가 존재하지 않는 경우
        describe('when purchase does not exist', () => {
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
