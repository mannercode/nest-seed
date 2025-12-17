import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingService: TicketHoldingClient }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    const ticketHoldingService = ctx.module.get(TicketHoldingClient)

    return { ...ctx, ticketHoldingService }
}
