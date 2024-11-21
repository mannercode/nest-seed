import { TicketHoldingService } from 'services/ticket-holding'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
    service: TicketHoldingService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const service = testContext.module.get(TicketHoldingService)

    return { testContext, service }
}

export async function closeFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}
