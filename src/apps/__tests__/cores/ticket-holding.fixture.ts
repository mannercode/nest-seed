import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, createAppTestContext } from '../__helpers__'

export type TicketHoldingFixture = TestFixture

export async function createTicketHoldingFixture() {
    const fix = await createAppTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    return { ...fix }
}
