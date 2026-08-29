import { ensure, pickIds } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import type { PaymentsService } from '#infrastructure'
import {
    buildCreatePaymentDto,
    createPayment,
    Errors,
    type AppTestContext
} from '../helpers/index.js'

describe('PaymentsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let paymentsService: PaymentsService

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('../helpers/index.js')
        const { PaymentsService } = await import('#infrastructure')
        fix = await createAppTestContext()
        teardown = fix.teardown
        paymentsService = fix.module.get(PaymentsService)
    })
    afterEach(() => teardown?.())

    describe('cancel', () => {
        it('결제 행을 지우지 않고 status를 cancelled로 전이한다', async () => {
            const payment = await createPayment(fix)

            await paymentsService.cancel(payment.id)

            const [cancelled] = await paymentsService.getMany([payment.id])
            expect(cancelled).toEqual({
                ...payment,
                status: 'cancelled',
                updatedAt: expect.any(Date)
            })
        })

        it('purchaseRecordId로 취소하며 결제가 없어도 멱등이다', async () => {
            const payment = await createPayment(fix)

            await paymentsService.cancelByPurchaseRecordId(ensure(payment.purchaseRecordId))
            await paymentsService.cancelByPurchaseRecordId(nullObjectId)

            const [cancelled] = await paymentsService.getMany([payment.id])
            expect(cancelled?.status).toBe('cancelled')
        })
    })

    describe('create', () => {
        it('생성된 결제를 반환한다', async () => {
            const createDto = buildCreatePaymentDto()

            const payment = await paymentsService.create(createDto)

            expect(payment).toEqual({
                ...createDto,
                createdAt: expect.any(Date),
                id: expect.any(String),
                status: 'completed',
                updatedAt: expect.any(Date)
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
            expect(
                retried.every(
                    (payment) => payment.updatedAt.getTime() === first?.updatedAt.getTime()
                )
            ).toBe(true)
        })

        it('동시 upsert의 중복 키 loser는 winner가 만든 결제를 반환한다', async () => {
            const existing = await createPayment(fix)
            const { PaymentsRepository } =
                await import('../../services/infrastructure/payments/payments.repository.js')
            const repository = fix.module.get(PaymentsRepository)
            jest.spyOn(repository.model, 'updateOne').mockReturnValueOnce({
                exec: () =>
                    Promise.reject(Object.assign(new Error('duplicate key'), { code: 11000 }))
            } as any)

            const retried = await paymentsService.create(
                buildCreatePaymentDto({ purchaseRecordId: ensure(existing.purchaseRecordId) })
            )

            expect(retried.id).toBe(existing.id)
            expect(retried.updatedAt).toEqual(existing.updatedAt)
        })

        it('중복 키가 아닌 저장소 오류는 그대로 전달한다', async () => {
            const { PaymentsRepository } =
                await import('../../services/infrastructure/payments/payments.repository.js')
            const repository = fix.module.get(PaymentsRepository)
            jest.spyOn(repository.model, 'updateOne').mockReturnValueOnce({
                exec: () => Promise.reject(new Error('database unavailable'))
            } as any)

            await expect(paymentsService.create(buildCreatePaymentDto())).rejects.toThrow(
                'database unavailable'
            )
        })
    })

    describe('getMany', () => {
        it('기존 문서에 purchaseRecordId가 없어도 null로 정규화한다', async () => {
            const { PaymentsRepository } =
                await import('../../services/infrastructure/payments/payments.repository.js')
            const repository = fix.module.get(PaymentsRepository)
            const now = new Date()
            const { insertedId } = await repository.model.collection.insertOne({
                amount: 1,
                createdAt: now,
                deletedAt: null,
                status: 'completed',
                updatedAt: now,
                userId: nullObjectId
            })

            const [legacy] = await paymentsService.getMany([String(insertedId)])

            expect(legacy).toEqual(
                expect.objectContaining({ id: String(insertedId), purchaseRecordId: null })
            )
        })

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
                message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
