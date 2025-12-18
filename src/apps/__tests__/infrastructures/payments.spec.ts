import { HttpStatus } from '@nestjs/common'
import type { PaymentDto } from 'apps/infrastructures'
import { pickIds } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreatePaymentDto, createPayment, Errors } from '../__helpers__'
import type { PaymentsFixture } from './payments.fixture'

describe('PaymentsService', () => {
    let fix: PaymentsFixture

    beforeEach(async () => {
        const { createPaymentsFixture } = await import('./payments.fixture')
        fix = await createPaymentsFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('create', () => {
        it('returns the created payment', async () => {
            const createDto = buildCreatePaymentDto()

            const payment = await fix.paymentsService.create(createDto)

            expect(payment).toEqual({
                ...createDto,
                id: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date)
            })
        })
    })

    describe('getMany', () => {
        describe('when the payments exist', () => {
            let payments: PaymentDto[]

            beforeEach(async () => {
                payments = await Promise.all([
                    createPayment(fix),
                    createPayment(fix),
                    createPayment(fix)
                ])
            })

            it('returns payments for the paymentIds', async () => {
                const fetchedPayments = await fix.paymentsService.getMany(pickIds(payments))

                expect(fetchedPayments).toEqual(expect.arrayContaining(payments))
            })
        })

        describe('when the paymentIds include a non-existent paymentId', () => {
            it('throws 404 Not Found', async () => {
                const promise = fix.paymentsService.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND,
                    message: Errors.Mongoose.MultipleDocumentsNotFound.message
                })
            })
        })
    })
})
