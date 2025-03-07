import { PaymentsService } from 'infrastructures'
import { closeFixture, createPaymentDto, Fixture } from './payments.fixture'

describe('Payments Module', () => {
    let fixture: Fixture
    let service: PaymentsService

    beforeEach(async () => {
        const { createFixture } = await import('./payments.fixture')

        fixture = await createFixture()
        service = fixture.paymentsService
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    it('processPayment', async () => {
        const { createDto, expectedDto } = createPaymentDto()

        const payment = await service.processPayment(createDto)
        expect(payment).toEqual(expectedDto)
    })

    it('getPayment', async () => {
        const { createDto } = createPaymentDto()
        const createdPayment = await service.processPayment(createDto)
        const gotPayment = await service.getPayment(createdPayment.id)

        expect(gotPayment).toEqual(createdPayment)
    })
})
