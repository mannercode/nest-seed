import { PaymentsService } from 'infrastructures'
import { nullObjectId } from 'testlib'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.infrasContext.module
    const paymentsService = module.get(PaymentsService)

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
