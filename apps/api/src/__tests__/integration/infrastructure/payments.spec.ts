import type { PaymentsService } from 'infrastructure'
import { pickIds } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { buildCreatePaymentDto, createPayment, Errors, type AppTestContext } from '../helpers'

describe('PaymentsService', () => {
    let fix: AppTestContext
    let paymentsService: PaymentsService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { PaymentsService } = await import('infrastructure')
        fix = await createAppTestContext()
        paymentsService = fix.module.get(PaymentsService)
    })
    afterEach(() => fix.teardown())

    describe('cancel', () => {
        it('결제를 취소한다', async () => {
            const payment = await createPayment(fix)

            await paymentsService.cancel(payment.id)

            const promise = paymentsService.getMany([payment.id])

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongoose.MultipleDocumentsNotFound([payment.id]).message,
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
                createdAt: expect.any(Date),
                id: expect.any(String),
                updatedAt: expect.any(Date)
            })
        })
    })

    describe('getMany', () => {
        it('주어진 paymentIds에 해당하는 결제를 반환한다', async () => {
            const payments = await Promise.all([
                createPayment(fix),
                createPayment(fix),
                createPayment(fix)
            ])

            const fetchedPayments = await paymentsService.getMany(pickIds(payments))

            expect(fetchedPayments).toEqual(expect.arrayContaining(payments))
        })

        it('paymentIds 중 하나라도 없으면 404를 던진다', async () => {
            const promise = paymentsService.getMany([nullObjectId])

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
