import { PaymentCreateDto, PaymentsService } from 'services/payments'
import { createHttpTestContext, HttpTestContext, nullObjectId } from 'testlib'
import { AppModule, configureApp } from '../app.module'

export interface Fixture {
    testContext: HttpTestContext
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const paymentsService = testContext.module.get(PaymentsService)

    return { testContext, paymentsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createPaymentDto = (overrides = {}) => {
    const createDto = {
        customerId: nullObjectId,
        amount: 0,
        ...overrides
    }

    const expectedDto = {
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        ...createDto
    }

    return { createDto, expectedDto }
}
