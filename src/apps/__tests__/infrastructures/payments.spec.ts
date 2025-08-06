import { PaymentDto } from 'apps/infrastructures'
import { buildCreatePaymentDto, createPayment2 } from '../__helpers__'
import type { Fixture } from './payments.fixture'

describe('PaymentsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./payments.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createPayment', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 결제를 생성하고 반환한다
            it('creates and returns a payment', async () => {
                const createDto = buildCreatePaymentDto()

                const payment = await fix.paymentsService.createPayment(createDto)
                expect(payment).toEqual({
                    ...createDto,
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            })
        })
    })

    describe('getPayments', () => {
        let createdPayment: PaymentDto

        // 결제 정보가 존재하는 경우
        describe('when the payments exist', () => {
            beforeEach(async () => {
                createdPayment = await createPayment2(fix)
            })

            // 결제 정보를 반환한다.
            it('returns the payments', async () => {
                const gotPayments = await fix.paymentsService.getPayments([createdPayment.id])
                expect(gotPayments).toEqual([createdPayment])
            })
        })
    })
})
