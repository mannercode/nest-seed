import { oid } from 'testlib'
import type { HoldTicketsDto } from 'apps/cores'
import type { TestContext } from 'testlib'

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
    const ticketHoldingClient = ctx.module.get(TicketHoldingClient)

    return ticketHoldingClient.holdTickets(buildHoldTicketsDto(holdDto))
}
