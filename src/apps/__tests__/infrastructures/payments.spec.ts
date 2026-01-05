import { HttpStatus } from '@nestjs/common'
import { pickIds } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreatePaymentDto, createPayment, Errors } from '../__helpers__'
import type { PaymentsFixture } from './payments.fixture'
import type { PaymentDto } from 'apps/infrastructures'

describe('PaymentsService', () => {
    let fix: PaymentsFixture

    beforeEach(async () => {
        const { createPaymentsFixture } = await import('./payments.fixture')
        fix = await createPaymentsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        // 생성된 결제를 반환한다
        it('returns the created payment', async () => {
            const createDto = buildCreatePaymentDto()

            const payment = await fix.paymentsClient.create(createDto)

            expect(payment).toEqual({
                ...createDto,
                id: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date)
            })
        })
    })

    describe('getMany', () => {
        // 결제가 존재할 때
        describe('when the payments exist', () => {
            let payments: PaymentDto[]

            beforeEach(async () => {
                payments = await Promise.all([
                    createPayment(fix),
                    createPayment(fix),
                    createPayment(fix)
                ])
            })

            // paymentIds에 대한 결제를 반환한다
            it('returns payments for the paymentIds', async () => {
                const fetchedPayments = await fix.paymentsClient.getMany(pickIds(payments))

                expect(fetchedPayments).toEqual(expect.arrayContaining(payments))
            })
        })

        // paymentIds에 존재하지 않는 paymentId가 포함될 때
        describe('when the paymentIds include a non-existent paymentId', () => {
            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                const promise = fix.paymentsClient.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND,
                    message: Errors.Mongoose.MultipleDocumentsNotFound.message
                })
            })
        })
    })
})
