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
        it('pending은 이력에서 숨기고 완료 후 발행 상태가 바뀌어도 최초 응답은 유지한다', async () => {
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

            await purchaseRecordsService.markEventPublished(pending.id)
            await purchaseRecordsService.markEventPublished(pending.id)
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
            ).rejects.toThrow('Only a pending purchase can be completed.')
            await expect(
                purchaseRecordsService.setPaymentId(pending.id, oid(0x99))
            ).rejects.toThrow('Only a pending purchase can receive a payment.')
            await expect(purchaseRecordsService.markEventPublished(pending.id)).rejects.toThrow(
                'Only a completed purchase can publish its event.'
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
                'Only a compensating purchase can be cancelled.'
            )
            expect(await purchaseRecordsService.findCompleted({ userId: record.userId })).toEqual([
                record
            ])
        })
    })
})
