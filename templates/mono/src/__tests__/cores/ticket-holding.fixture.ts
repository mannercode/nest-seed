import { TicketHoldingModule, TicketHoldingService } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingService: TicketHoldingService }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext({ imports: [TicketHoldingModule] })

    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    return { ...ctx, ticketHoldingService }
}
