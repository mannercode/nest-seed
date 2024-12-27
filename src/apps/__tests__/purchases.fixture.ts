import { PurchasesService } from 'cores'
import { PaymentsService } from 'infrastructures'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    purchasesService: PurchasesService
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createTestContext()

    const purchasesService = testContext.coresContext.module.get(PurchasesService)
    const paymentsService = testContext.infrasContext.module.get(PaymentsService)

    return { testContext, purchasesService, paymentsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
