import { PurchasesService } from 'services/cores'
import { PaymentsService } from 'services/infrastructures'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    purchasesService: PurchasesService
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createTestContext()

    const purchasesService = testContext.module.get(PurchasesService)
    const paymentsService = testContext.module.get(PaymentsService)

    return { testContext, purchasesService, paymentsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
