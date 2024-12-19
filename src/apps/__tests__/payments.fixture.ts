import { PaymentsService } from 'services/infrastructures'
import { nullObjectId } from 'testlib'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createTestContext()
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
