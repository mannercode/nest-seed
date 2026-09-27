import type { MockInstance } from 'vitest'
import { DateUtil, ensure, pickIds } from '@mannercode/common'
import { instant, oid } from '@mannercode/testing'
import { type PurchaseRecordDto, PurchaseRecordsService, PurchaseRecordStatus } from '#core'
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
        it('구매 기록을 생성하면 생성된 정보를 반환한다', async () => {
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
        describe('멱등성 키가 서로 다른 구매 기록 256건이 존재하면', () => {
            const userId = oid(0x1)
            let records: PurchaseRecordDto[]
            let repository: PurchaseRecordsRepository
            let findOne: MockInstance<PurchaseRecordsRepository['collection']['findOne']>

            beforeEach(async () => {
                records = await Promise.all(
                    Array.from({ length: 256 }, (_, index) =>
                        purchaseRecordsService.create(buildCreatePurchaseRecordDto({ userId }), {
                            idempotency: { fingerprint: 'fingerprint', key: `key-${index}` },
                            pending: true
                        })
                    )
                )
                repository = fix.module.get(PurchaseRecordsRepository)
                findOne = vi.spyOn(repository.collection, 'findOne')
            })

            describe.each([
                { condition: '조회할 키가 등록되어 있으면', idempotencyKey: 'key-255' },
                { condition: '조회할 키가 등록되어 있지 않으면', idempotencyKey: 'missing-key' }
            ])('$condition', ({ idempotencyKey }) => {
                let query: Parameters<typeof purchaseRecordsService.findIdempotencyOperation>[0]
                beforeEach(() => {
                    query = { userId, idempotencyKey }
                })
                it('멱등성 작업을 조회하면 문서와 인덱스 키를 각각 한 건 이하로 읽는다', async () => {
                    const operation = await purchaseRecordsService.findIdempotencyOperation(query)

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
                })
            })
        })
    })

    describe('findCompleted', () => {
        describe('서로 다른 사용자의 완료된 구매 기록이 존재하면', () => {
            const userId = oid(0x1)
            let mine1: PurchaseRecordDto
            let mine2: PurchaseRecordDto

            beforeEach(async () => {
                const now = vi.spyOn(DateUtil, 'now')
                try {
                    now.mockReturnValue(instant('2025-01-01T00:00:00Z'))
                    mine1 = await createPurchaseRecord(fix, { userId })
                    now.mockReturnValue(instant('2025-01-02T00:00:00Z'))
                    mine2 = await createPurchaseRecord(fix, { userId })
                } finally {
                    now.mockRestore()
                }
                await createPurchaseRecord(fix, { userId: oid(0x2) })
            })

            it('완료된 구매를 조회하면 지정한 사용자의 기록만 반환한다', async () => {
                const records = await purchaseRecordsService.findCompleted({ userId })

                expect(records).toEqual(expect.arrayContaining([mine1, mine2]))
                expect(records).toHaveLength(2)
                expect(records.every((record) => record.userId === userId)).toBe(true)
            })

            it('완료된 구매를 조회하면 최근 구매 기록부터 반환한다', async () => {
                const records = await purchaseRecordsService.findCompleted({ userId })

                expect(pickIds(records)).toEqual([mine2.id, mine1.id])
            })
        })

        describe('사용자의 구매 기록이 없으면', () => {
            let query: Parameters<typeof purchaseRecordsService.findCompleted>[0]
            beforeEach(() => {
                query = { userId: oid(0x1) }
            })
            it('완료된 구매 기록을 조회하면 빈 배열을 반환한다', async () => {
                const records = await purchaseRecordsService.findCompleted(query)

                expect(records).toEqual([])
            })
        })
    })

    describe('PurchaseRecordStatus', () => {
        describe('멱등성 키가 있는 처리 중인 구매 기록이 존재하면', () => {
            const createDto = buildCreatePurchaseRecordDto({ paymentId: null })
            const idempotency = { fingerprint: 'fingerprint', key: 'purchase-key' }
            let pending: PurchaseRecordDto

            beforeEach(async () => {
                pending = await purchaseRecordsService.create(createDto, {
                    idempotency,
                    pending: true
                })
            })

            it('완료된 구매 이력을 조회하면 처리 중인 구매를 제외한다', async () => {
                expect(
                    await purchaseRecordsService.findCompleted({ userId: createDto.userId })
                ).toEqual([])
            })

            describe('결제 ID가 연결되어 있으면', () => {
                let response: PurchaseRecordDto

                beforeEach(async () => {
                    response = await purchaseRecordsService.setPaymentId(pending.id, oid(0x99))
                })

                it('완료 처리하면 구매 이력에 포함하고 최초 응답을 보존한다', async () => {
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
                })

                describe('구매가 완료되었으면', () => {
                    let completed: PurchaseRecordDto

                    beforeEach(async () => {
                        completed = await fix.module
                            .get(PurchaseTransactionRepository)
                            .run((transaction) =>
                                purchaseRecordsService.markCompleted(
                                    pending.id,
                                    response,
                                    transaction
                                )
                            )
                    })

                    it('뒤늦은 보상 요청을 거절한다', async () => {
                        expect(
                            await purchaseRecordsService.beginCompensation(pending.id, {
                                response: { message: 'late failure' },
                                status: 400
                            })
                        ).toBe(false)
                    })

                    it('취소를 요청하면 예외를 던지고 완료된 기록을 유지한다', async () => {
                        await expect(
                            purchaseRecordsService.markCancelled(completed.id)
                        ).rejects.toThrow(
                            expect.objectContaining({
                                status: 500,
                                cause: 'Only a compensating purchase can be cancelled.'
                            })
                        )
                        expect(
                            await purchaseRecordsService.findCompleted({ userId: completed.userId })
                        ).toEqual([completed])
                    })
                })
            })

            describe('보상이 시작되었으면', () => {
                const error = { response: { message: 'purchase rejected' }, status: 400 }

                beforeEach(async () => {
                    expect(await purchaseRecordsService.beginCompensation(pending.id, error)).toBe(
                        true
                    )
                })

                it('보상 시작을 다시 요청해도 허용한다', async () => {
                    expect(await purchaseRecordsService.beginCompensation(pending.id, error)).toBe(
                        true
                    )
                })

                it('완료를 요청하면 예외를 던진다', async () => {
                    await expect(
                        fix.module
                            .get(PurchaseTransactionRepository)
                            .run((transaction) =>
                                purchaseRecordsService.markCompleted(
                                    pending.id,
                                    pending,
                                    transaction
                                )
                            )
                    ).rejects.toThrow(
                        expect.objectContaining({
                            status: 500,
                            cause: 'Only a pending purchase can be completed.'
                        })
                    )
                })

                it('결제 ID 연결을 요청하면 예외를 던진다', async () => {
                    await expect(
                        purchaseRecordsService.setPaymentId(pending.id, oid(0x99))
                    ).rejects.toThrow(
                        expect.objectContaining({
                            status: 500,
                            cause: 'Only a pending purchase can receive a payment.'
                        })
                    )
                })

                describe('취소까지 완료되었으면', () => {
                    beforeEach(async () => {
                        await purchaseRecordsService.markCancelled(pending.id)
                    })

                    it('취소를 다시 요청해도 취소 상태와 기존 오류 정보를 유지한다', async () => {
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
                })
            })
        })
    })
})
