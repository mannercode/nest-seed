import { PaymentDto } from 'apps/infrastructures'
import { buildCreatePaymentDto, createPayment } from '../__helpers__'
import type { Fixture } from './payments.fixture'

describe('PaymentsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./payments.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 결제를 생성하고 반환한다
            it('creates and returns a payment', async () => {
                const createDto = buildCreatePaymentDto()

                const payment = await fixture.paymentsService.create(createDto)
                expect(payment).toEqual({
                    ...createDto,
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            })
        })
    })

    describe('getMany', () => {
        let createdPayment: PaymentDto

        // 결제 정보가 존재하는 경우
        describe('when payments exist', () => {
            beforeEach(async () => {
                createdPayment = await createPayment(fixture)
            })

            // 결제 정보를 반환한다.
            it('returns the payments', async () => {
                const gotPayments = await fixture.paymentsService.getMany([createdPayment.id])
                expect(gotPayments).toEqual([createdPayment])
            })
        })
    })
})
