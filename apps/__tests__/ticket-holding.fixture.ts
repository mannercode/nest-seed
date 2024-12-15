import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { TicketHoldingService } from 'services/cores'
import { HttpTestContext, createHttpTestContext } from 'testlib'

export interface Fixture {
    testContext: HttpTestContext
    ticketHoldingService: TicketHoldingService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const ticketHoldingService = testContext.module.get(TicketHoldingService)

    return { testContext, ticketHoldingService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
