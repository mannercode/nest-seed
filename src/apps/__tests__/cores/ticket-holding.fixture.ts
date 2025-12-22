import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingClient: TicketHoldingClient }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    const ticketHoldingClient = ctx.module.get(TicketHoldingClient)

    return { ...ctx, ticketHoldingClient }
}
