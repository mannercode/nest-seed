import { buildCreatePaymentDto, Fixture } from './payments.fixture'

// 기능 단위: 결제 서비스
describe('PaymentsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./payments.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('processPayment()', () => {
        // 기대 결과: 결제 요청을 성공적으로 처리한다.
        it('processes a payment request successfully', async () => {
            const { createDto, expectedDto } = buildCreatePaymentDto()

            const payment = await fix.paymentsClient.processPayment(createDto)
            expect(payment).toEqual(expectedDto)
        })
    })

    describe('getPayments()', () => {
        // 상황: 존재하는 결제 정보일 때
        describe('when the payments exist', () => {
            // 기대 결과: 해당하는 결제 정보를 반환한다.
            it('returns the corresponding payment records', async () => {
                const { createDto } = buildCreatePaymentDto()
                const createdPayment = await fix.paymentsClient.processPayment(createDto)

                const gotPayments = await fix.paymentsClient.getPayments([createdPayment.id])
                expect(gotPayments).toEqual([createdPayment])
            })
        })
    })
})
