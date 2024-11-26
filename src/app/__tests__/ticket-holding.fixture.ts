import { TicketHoldingService } from 'services/ticket-holding'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'

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
