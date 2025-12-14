import { HoldTicketsDto } from 'apps/cores'
import { oid, TestContext } from 'testlib'

export function buildHoldTicketsDto(holdDto?: Partial<HoldTicketsDto>) {
    return {
        customerId: oid(0x0),
        showtimeId: oid(0x0),
        ticketIds: [oid(0x1), oid(0x2)],
        ...holdDto
    }
}

export async function holdTickets(ctx: TestContext, holdDto?: Partial<HoldTicketsDto>) {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = ctx.module.get(TicketHoldingClient)

    return ticketHoldingService.holdTickets(buildHoldTicketsDto(holdDto))
}
