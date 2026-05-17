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
                message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
