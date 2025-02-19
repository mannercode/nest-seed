import { PurchasesService } from 'cores'
import { PaymentsService } from 'infrastructures'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    purchasesService: PurchasesService
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()

    const purchasesService = testContext.coresContext.module.get(PurchasesService)
    const paymentsService = testContext.infrasContext.module.get(PaymentsService)

    return { testContext, purchasesService, paymentsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
