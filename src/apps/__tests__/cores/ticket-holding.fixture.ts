import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, setupTestContext } from '../__helpers__'

export type TicketHoldingFixture = TestFixture

export const createFixture = async () => {
    const context = await setupTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    return { ...context }
}
