import type { MockInstance } from 'vitest'
import { ensure, pickIds } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { type PaymentDto, PaymentsService } from '#infrastructure'
import {
    buildCreatePaymentDto,
    createPayment,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { PaymentsRepository } from '../../services/infrastructure/payments/payments.repository.js'

describe('PaymentsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let paymentsService: PaymentsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        paymentsService = fix.module.get(PaymentsService)
    })
    afterEach(() => teardown?.())

    describe('cancel', () => {
        describe('완료된 결제가 존재하면', () => {
            let payment: PaymentDto
            beforeEach(async () => {
                payment = await createPayment(fix)
            })
            it('취소를 요청하면 기록을 유지하며 취소 상태로 바꾼다', async () => {
                await paymentsService.cancel(payment.id)

                const [cancelled] = await paymentsService.getMany([payment.id])
                expect(cancelled).toEqual({
                    ...payment,
                    status: 'cancelled',
                    updatedAt: expect.any(Temporal.Instant)
                })
            })
        })

        describe('ID에 해당하는 결제가 없으면', () => {
            let paymentId: Parameters<typeof paymentsService.cancel>[0]
            beforeEach(() => {
                paymentId = nullObjectId
            })
            it('결제를 취소하면 404 예외를 던진다', async () => {
                await expect(paymentsService.cancel(paymentId)).rejects.toMatchObject({
                    response: Errors.Mongo.DocumentNotFound(nullObjectId),
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('create', () => {
        it('생성된 결제를 반환한다', async () => {
            const createDto = buildCreatePaymentDto()

            const payment = await paymentsService.create(createDto)

            expect(payment).toEqual({
                ...createDto,
                createdAt: expect.any(Temporal.Instant),
                id: expect.any(String),
                status: 'completed',
                updatedAt: expect.any(Temporal.Instant)
            })
        })

        it('같은 구매 ID로 동시에 결제를 요청하면 같은 결제를 반환한다', async () => {
            const createDto = buildCreatePaymentDto()

            const [first, ...retried] = await Promise.all(
                Array.from({ length: 10 }, () => paymentsService.create(createDto))
            )

            expect(new Set([first?.id, ...retried.map((payment) => payment.id)])).toEqual(
                new Set([first?.id])
            )
            expect(first).toBeDefined()
            expect(
                retried.every((payment) => payment.updatedAt.equals(ensure(first).updatedAt))
            ).toBe(true)
        })

        describe('기존 결제가 존재하고 새 저장에서 중복 키 오류가 발생하면', () => {
            let existing: PaymentDto
            beforeEach(async () => {
                existing = await createPayment(fix)

                const repository = fix.module.get(PaymentsRepository)
                vi.spyOn(repository.collection, 'updateOne').mockRejectedValueOnce(
                    Object.assign(new Error('duplicate key'), { code: 11000 })
                )
            })
            it('같은 구매의 결제를 다시 요청하면 기존 결제를 반환한다', async () => {
                const retried = await paymentsService.create(
                    buildCreatePaymentDto({ purchaseRecordId: ensure(existing.purchaseRecordId) })
                )

                expect(retried.id).toBe(existing.id)
                expect(retried.updatedAt).toEqual(existing.updatedAt)
            })
        })

        describe('저장소에서 중복 키 이외의 오류가 발생하면', () => {
            beforeEach(() => {
                const repository = fix.module.get(PaymentsRepository)
                vi.spyOn(repository.collection, 'updateOne').mockRejectedValueOnce(
                    new Error('database unavailable')
                )
            })
            it('결제 생성을 요청하면 저장소 오류를 던진다', async () => {
                await expect(paymentsService.create(buildCreatePaymentDto())).rejects.toThrow(
                    'database unavailable'
                )
            })
        })
    })

    describe('getMany', () => {
        describe('결제 세 건이 존재하면', () => {
            let payments: PaymentDto[]
            beforeEach(async () => {
                payments = await Promise.all([
                    createPayment(fix),
                    createPayment(fix),
                    createPayment(fix)
                ])
            })
            it('해당 ID들로 조회하면 세 결제를 반환한다', async () => {
                const fetchedPayments = await paymentsService.getMany(pickIds(payments))

                expect(fetchedPayments).toEqual(expect.arrayContaining(payments))
            })
        })

        describe('ID에 해당하는 결제가 없으면', () => {
            let paymentIds: Parameters<typeof paymentsService.getMany>[0]
            beforeEach(() => {
                paymentIds = [nullObjectId]
            })
            it('결제를 조회하면 404 예외를 던진다', async () => {
                const promise = paymentsService.getMany(paymentIds)

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]).message,
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('cancelByPurchaseRecordId', () => {
        describe('완료된 결제가 존재하면', () => {
            let payment: PaymentDto
            beforeEach(async () => {
                payment = await createPayment(fix)
            })
            it('구매 ID로 취소를 요청하면 해당 결제를 취소한다', async () => {
                await paymentsService.cancelByPurchaseRecordId({
                    purchaseRecordId: ensure(payment.purchaseRecordId)
                })
                const [cancelled] = await paymentsService.getMany([payment.id])
                expect(cancelled?.status).toBe('cancelled')
            })
        })
        describe('구매 ID에 해당하는 결제가 없으면', () => {
            let query: Parameters<typeof paymentsService.cancelByPurchaseRecordId>[0]
            beforeEach(() => {
                query = { purchaseRecordId: nullObjectId }
            })
            it('구매 결제를 취소하면 오류 없이 완료한다', async () => {
                await paymentsService.cancelByPurchaseRecordId(query)
            })
        })
    })

    describe('구매 ID가 서로 다른 결제 256건이 존재하면', () => {
        let createDto: ReturnType<typeof buildCreatePaymentDto>
        let payments: PaymentDto[]
        let repository: PaymentsRepository
        let updateOne: MockInstance<PaymentsRepository['collection']['updateOne']>
        let findOne: MockInstance<PaymentsRepository['collection']['findOne']>
        beforeEach(async () => {
            const createDtos = Array.from({ length: 256 }, () => buildCreatePaymentDto())
            payments = await Promise.all(createDtos.map((dto) => paymentsService.create(dto)))
            createDto = ensure(createDtos.at(-1))
            repository = fix.module.get(PaymentsRepository)
            updateOne = vi.spyOn(repository.collection, 'updateOne')
            findOne = vi.spyOn(repository.collection, 'findOne')
        })
        it('같은 구매의 결제를 다시 생성할 때 인덱스로 해당 결제만 읽는다', async () => {
            const retried = await paymentsService.create(createDto)
            expect(retried).toEqual(payments.at(-1))
            const filters = [ensure(updateOne.mock.calls[0])[0], ensure(findOne.mock.calls[0])[0]]
            for (const filter of filters) {
                const { executionStats, queryPlanner } = await repository.collection
                    .find(filter)
                    .limit(1)
                    .explain('executionStats')
                expect(JSON.stringify(queryPlanner.winningPlan)).toContain(
                    'purchaseRecordId_partial_unique'
                )
                expect(executionStats.totalDocsExamined).toBe(1)
                expect(executionStats.totalKeysExamined).toBe(1)
            }
        })
        it('구매 ID로 결제를 취소할 때 인덱스로 해당 결제만 읽는다', async () => {
            await paymentsService.cancelByPurchaseRecordId({
                purchaseRecordId: createDto.purchaseRecordId
            })
            const filters = [ensure(findOne.mock.calls[0])[0]]
            for (const filter of filters) {
                const { executionStats, queryPlanner } = await repository.collection
                    .find(filter)
                    .limit(1)
                    .explain('executionStats')
                expect(JSON.stringify(queryPlanner.winningPlan)).toContain(
                    'purchaseRecordId_partial_unique'
                )
                expect(executionStats.totalDocsExamined).toBe(1)
                expect(executionStats.totalKeysExamined).toBe(1)
            }
        })
    })
})
