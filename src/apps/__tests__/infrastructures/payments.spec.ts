import { buildCreatePaymentDto, Fixture } from './payments.fixture'

describe('PaymentsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./payments.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('processPayment', () => {
        // 결제 요청을 성공적으로 처리한다.
        it('processes a payment request successfully', async () => {
            const createDto = buildCreatePaymentDto()

            const payment = await fix.paymentsService.processPayment(createDto)
            expect(payment).toEqual({
                ...createDto,
                id: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date)
            })
        })
    })

    describe('getPayments', () => {
        // 존재하는 결제 정보일 때
        describe('when the payments exist', () => {
            // 해당하는 결제 정보를 반환한다.
            it('returns the corresponding payment records', async () => {
                const createDto = buildCreatePaymentDto()
                const createdPayment = await fix.paymentsService.processPayment(createDto)

                const gotPayments = await fix.paymentsService.getPayments([createdPayment.id])
                expect(gotPayments).toEqual([createdPayment])
            })
        })
    })
})
