import { TicketHoldingService } from 'cores'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    ticketHoldingService: TicketHoldingService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module

    const ticketHoldingService = module.get(TicketHoldingService)

    return { testContext, ticketHoldingService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
