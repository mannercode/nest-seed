import { ensure, pickIds } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { PaymentsService } from '#infrastructure'
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
        it('결제 기록을 유지하며 취소 상태로 바꾼다', async () => {
            const payment = await createPayment(fix)

            await paymentsService.cancel(payment.id)

            const [cancelled] = await paymentsService.getMany([payment.id])
            expect(cancelled).toEqual({
                ...payment,
                status: 'cancelled',
                updatedAt: expect.any(Temporal.Instant)
            })
        })

        it('구매 ID로 결제를 취소하고 해당 결제가 없어도 오류를 던지지 않는다', async () => {
            const payment = await createPayment(fix)

            await paymentsService.cancelByPurchaseRecordId({
                purchaseRecordId: ensure(payment.purchaseRecordId)
            })
            await paymentsService.cancelByPurchaseRecordId({ purchaseRecordId: nullObjectId })

            const [cancelled] = await paymentsService.getMany([payment.id])
            expect(cancelled?.status).toBe('cancelled')
        })

        it('결제 ID가 없으면 404를 던진다', async () => {
            await expect(paymentsService.cancel(nullObjectId)).rejects.toMatchObject({
                response: Errors.Mongo.DocumentNotFound(nullObjectId),
                status: HttpStatus.NOT_FOUND
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

        it('같은 purchaseRecordId 재시도는 결제를 중복 생성하지 않는다', async () => {
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

        it('결제가 누적되어도 생성·재조회·취소 조회는 구매 ID 인덱스로 대상만 읽는다', async () => {
            const createDtos = Array.from({ length: 256 }, () => buildCreatePaymentDto())
            const payments = await Promise.all(createDtos.map((dto) => paymentsService.create(dto)))
            const createDto = ensure(createDtos.at(-1))
            const repository = fix.module.get(PaymentsRepository)
            const updateOne = vi.spyOn(repository.collection, 'updateOne')
            const findOne = vi.spyOn(repository.collection, 'findOne')

            const retried = await paymentsService.create(createDto)
            expect(retried).toEqual(payments.at(-1))
            await paymentsService.cancelByPurchaseRecordId({
                purchaseRecordId: createDto.purchaseRecordId
            })

            const filters = [
                ensure(updateOne.mock.calls[0])[0],
                ensure(findOne.mock.calls[0])[0],
                ensure(findOne.mock.calls[1])[0]
            ]
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

        it('결제 저장 중 중복 키 오류가 나면 이미 저장된 같은 구매의 결제를 반환한다', async () => {
            const existing = await createPayment(fix)

            const repository = fix.module.get(PaymentsRepository)
            vi.spyOn(repository.collection, 'updateOne').mockRejectedValueOnce(
                Object.assign(new Error('duplicate key'), { code: 11000 })
            )

            const retried = await paymentsService.create(
                buildCreatePaymentDto({ purchaseRecordId: ensure(existing.purchaseRecordId) })
            )

            expect(retried.id).toBe(existing.id)
            expect(retried.updatedAt).toEqual(existing.updatedAt)
        })

        it('중복 키가 아닌 저장소 오류는 그대로 전달한다', async () => {
            const repository = fix.module.get(PaymentsRepository)
            vi.spyOn(repository.collection, 'updateOne').mockRejectedValueOnce(
                new Error('database unavailable')
            )

            await expect(paymentsService.create(buildCreatePaymentDto())).rejects.toThrow(
                'database unavailable'
            )
        })
    })

    describe('getMany', () => {
        it('결제 ID 목록에 해당하는 결제를 반환한다', async () => {
            const payments = await Promise.all([
                createPayment(fix),
                createPayment(fix),
                createPayment(fix)
            ])

            const fetchedPayments = await paymentsService.getMany(pickIds(payments))

            expect(fetchedPayments).toEqual(expect.arrayContaining(payments))
        })

        it('결제 ID 목록 중 하나라도 없으면 404를 던진다', async () => {
            const promise = paymentsService.getMany([nullObjectId])

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]).message,
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
