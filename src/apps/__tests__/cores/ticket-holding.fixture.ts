import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, createAppTestContext } from '../__helpers__'

export type TicketHoldingFixture = TestFixture & { ticketHoldingService: TicketHoldingClient }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    const ticketHoldingService = ctx.module.get(TicketHoldingClient)

    return { ...ctx, ticketHoldingService }
}
