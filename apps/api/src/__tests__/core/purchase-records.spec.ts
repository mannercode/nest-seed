import { ensure, pickIds, sleep } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { PurchaseRecordsService, PurchaseRecordStatus } from '#core'
import {
    buildCreatePurchaseRecordDto,
    createPurchaseRecord,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

import { PurchaseTransactionRepository } from '../../services/application/purchase/internal/index.js'
import { PurchaseRecordsRepository } from '../../services/core/purchase-records/purchase-records.repository.js'

describe('PurchaseRecordsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let purchaseRecordsService: PurchaseRecordsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        purchaseRecordsService = fix.module.get(PurchaseRecordsService)
    })
    afterEach(() => teardown?.())

    describe('create', () => {
        it('생성된 구매 기록을 반환한다', async () => {
            const createDto = buildCreatePurchaseRecordDto()
            const purchaseRecord = await purchaseRecordsService.create(createDto)

            expect(purchaseRecord).toEqual({
                createdAt: expect.any(Temporal.Instant),
                id: expect.any(String),
                updatedAt: expect.any(Temporal.Instant),
                ...createDto
            })
        })
    })

    describe('findIdempotencyOperation', () => {
        it.each(['key-255', 'missing-key'])(
            '구매 기록이 누적되어도 %s 조회는 대상 문서만 읽는다',
            async (idempotencyKey) => {
                const userId = oid(0x1)
                const records = await Promise.all(
                    Array.from({ length: 256 }, (_, index) =>
                        purchaseRecordsService.create(buildCreatePurchaseRecordDto({ userId }), {
                            idempotency: { fingerprint: 'fingerprint', key: `key-${index}` },
                            pending: true
                        })
                    )
                )
                const repository = fix.module.get(PurchaseRecordsRepository)
                const findOne = vi.spyOn(repository.collection, 'findOne')

                const operation = await purchaseRecordsService.findIdempotencyOperation({
                    userId,
                    idempotencyKey
                })

                expect(operation?.purchaseRecord).toEqual(
                    idempotencyKey === 'key-255' ? records[255] : undefined
                )
                // 실제 서비스가 보낸 조회를 explain해 데이터 증가에 따른 전체 순회를 막는다.
                const [filter] = ensure(findOne.mock.calls[0])
                const { executionStats } = await repository.collection
                    .find(filter)
                    .limit(1)
                    .explain('executionStats')
                expect(executionStats.totalDocsExamined).toBeLessThanOrEqual(1)
                expect(executionStats.totalKeysExamined).toBeLessThanOrEqual(1)
            }
        )
    })

    describe('findCompleted', () => {
        it('해당 userId의 구매 기록만 반환한다', async () => {
            const userId = oid(0x1)
            const mine1 = await createPurchaseRecord(fix, { userId })
            const mine2 = await createPurchaseRecord(fix, { userId })
            await createPurchaseRecord(fix, { userId: oid(0x2) })

            const records = await purchaseRecordsService.findCompleted({ userId })

            expect(records).toEqual(expect.arrayContaining([mine1, mine2]))
            expect(records).toHaveLength(2)
            expect(records.every((record) => record.userId === userId)).toBe(true)
        })

        it('구매 기록이 없으면 빈 배열을 반환한다', async () => {
            const records = await purchaseRecordsService.findCompleted({ userId: oid(0x1) })

            expect(records).toEqual([])
        })

        it('구매 기록을 최신 구매가 먼저 오도록 정렬해 반환한다', async () => {
            const userId = oid(0x1)
            const first = await createPurchaseRecord(fix, { userId })
            // createdAt이 ms 단위에서 동률이 되지 않도록 두 생성 사이를 벌린다.
            await sleep(50)
            const second = await createPurchaseRecord(fix, { userId })

            const records = await purchaseRecordsService.findCompleted({ userId })

            expect(pickIds(records)).toEqual([second.id, first.id])
        })
    })

    describe('PurchaseRecordStatus', () => {
        it('pending은 이력에서 숨기고 완료 후 최초 응답을 유지하며 늦은 보상을 거절한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const idempotency = { fingerprint: 'fingerprint', key: 'purchase-key' }
            const pending = await purchaseRecordsService.create(createDto, {
                idempotency,
                pending: true
            })
            expect(
                await purchaseRecordsService.findCompleted({ userId: createDto.userId })
            ).toEqual([])
            const response = await purchaseRecordsService.setPaymentId(pending.id, oid(0x99))
            const transactions = fix.module.get(PurchaseTransactionRepository)
            const completed = await transactions.run((transaction) =>
                purchaseRecordsService.markCompleted(pending.id, response, transaction)
            )
            expect(
                await purchaseRecordsService.findCompleted({ userId: createDto.userId })
            ).toEqual([completed])

            const operation = ensure(
                await purchaseRecordsService.findIdempotencyOperation({
                    userId: createDto.userId,
                    idempotencyKey: idempotency.key
                })
            )
            expect(operation.response).toEqual(response)
            expect(operation.status).toBe(PurchaseRecordStatus.Completed)
            expect(
                await purchaseRecordsService.beginCompensation(pending.id, {
                    response: { message: 'late failure' },
                    status: 400
                })
            ).toBe(false)
        })

        it('보상 시작 뒤 늦은 완료를 거절하고 보상·취소의 재시도는 허용한다', async () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const idempotency = { fingerprint: 'fingerprint', key: 'purchase-key' }
            const pending = await purchaseRecordsService.create(createDto, {
                idempotency,
                pending: true
            })
            const error = { response: { message: 'purchase rejected' }, status: 400 }
            expect(await purchaseRecordsService.beginCompensation(pending.id, error)).toBe(true)
            expect(await purchaseRecordsService.beginCompensation(pending.id, error)).toBe(true)
            await expect(
                fix.module
                    .get(PurchaseTransactionRepository)
                    .run((transaction) =>
                        purchaseRecordsService.markCompleted(pending.id, pending, transaction)
                    )
            ).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Only a pending purchase can be completed.'
                })
            )
            await expect(
                purchaseRecordsService.setPaymentId(pending.id, oid(0x99))
            ).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Only a pending purchase can receive a payment.'
                })
            )
            await purchaseRecordsService.markCancelled(pending.id)
            await purchaseRecordsService.markCancelled(pending.id)
            expect(
                await purchaseRecordsService.findCompleted({ userId: createDto.userId })
            ).toEqual([])
            const operation = ensure(
                await purchaseRecordsService.findIdempotencyOperation({
                    userId: createDto.userId,
                    idempotencyKey: idempotency.key
                })
            )
            expect(operation).toMatchObject({
                errorResponse: error.response,
                errorStatus: error.status,
                status: PurchaseRecordStatus.Cancelled
            })
        })

        it('완료 상태는 취소로 바꾸지 않는다', async () => {
            const record = await createPurchaseRecord(fix)
            await expect(purchaseRecordsService.markCancelled(record.id)).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Only a compensating purchase can be cancelled.'
                })
            )
            expect(await purchaseRecordsService.findCompleted({ userId: record.userId })).toEqual([
                record
            ])
        })
    })
})
