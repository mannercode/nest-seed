import type { TestContext } from '@mannercode/testing'
import type { HoldTicketsDto } from 'cores'
import { oid } from '@mannercode/testing'

export function buildHoldTicketsDto(holdDto?: Partial<HoldTicketsDto>) {
    return {
        customerId: oid(0x0),
        showtimeId: oid(0x0),
        ticketIds: [oid(0x1), oid(0x2)],
        ...holdDto
    }
}

export async function holdTickets(ctx: TestContext, holdDto?: Partial<HoldTicketsDto>) {
    const { TicketHoldingService } = await import('cores')
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    return ticketHoldingService.holdTickets(buildHoldTicketsDto(holdDto))
}
