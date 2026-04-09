import { TicketHoldingModule, TicketHoldingService } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingService: TicketHoldingService }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({ imports: [TicketHoldingModule] })

    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    return { ...ctx, ticketHoldingService }
}
