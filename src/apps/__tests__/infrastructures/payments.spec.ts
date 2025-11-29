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
        describe('when the payload is valid', () => {
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

        describe('when the payments exist', () => {
            beforeEach(async () => {
                createdPayment = await createPayment(fixture)
            })

            it('returns the payments', async () => {
                const gotPayments = await fixture.paymentsService.getMany([createdPayment.id])
                expect(gotPayments).toEqual([createdPayment])
            })
        })
    })
})
