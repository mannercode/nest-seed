import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingClient: TicketHoldingClient }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    const ticketHoldingClient = ctx.module.get(TicketHoldingClient)

    return { ...ctx, ticketHoldingClient }
}
