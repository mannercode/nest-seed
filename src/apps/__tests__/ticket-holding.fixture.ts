import { TicketHoldingService } from 'cores'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    ticketHoldingService: TicketHoldingService
}

export async function createFixture() {
    const testContext = await createTestContext()
    const module = testContext.coresContext.module

    const ticketHoldingService = module.get(TicketHoldingService)

    return { testContext, ticketHoldingService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
