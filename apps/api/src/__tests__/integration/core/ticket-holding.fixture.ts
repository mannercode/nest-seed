import { TicketHoldingService } from 'core'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type TicketHoldingFixture = AppTestContext & { ticketHoldingService: TicketHoldingService }

export async function createTicketHoldingFixture() {
    const ctx = await createAppTestContext()

    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    return { ...ctx, ticketHoldingService }
}
