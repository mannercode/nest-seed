import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { PurchasesService } from 'services/cores'
import { PaymentsService } from 'services/infrastructures'
import { createHttpTestContext, HttpTestContext } from 'testlib'

export interface Fixture {
    testContext: HttpTestContext
    purchasesService: PurchasesService
    paymentsService: PaymentsService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)

    const purchasesService = testContext.module.get(PurchasesService)
    const paymentsService = testContext.module.get(PaymentsService)

    return { testContext, purchasesService, paymentsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
