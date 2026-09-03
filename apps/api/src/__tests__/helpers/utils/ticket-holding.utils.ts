import { oid, type TestContext } from '@mannercode/testing'
import { type HoldTicketsDto, TicketHoldingService } from '#core'

export function buildHoldTicketsDto(holdDto?: Partial<HoldTicketsDto>) {
    return { userId: oid(0x0), showtimeId: oid(0x0), ticketIds: [oid(0x1), oid(0x2)], ...holdDto }
}

export async function holdTickets(ctx: TestContext, holdDto?: Partial<HoldTicketsDto>) {
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    return ticketHoldingService.holdTickets(buildHoldTicketsDto(holdDto))
}
