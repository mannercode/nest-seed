import { HoldTicketsDto } from 'apps/cores'
import { oid, TestContext } from 'testlib'

export async function holdTickets({ module }: TestContext, holdDto?: Partial<HoldTicketsDto>) {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.holdTickets({
        customerId: oid(0x0),
        showtimeId: oid(0x0),
        ticketIds: [oid(0x1), oid(0x2)],
        ...holdDto
    })
}

export async function releaseTickets(
    { module }: TestContext,
    showtimeId: string,
    customerId: string
) {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.releaseTickets(showtimeId, customerId)
}

export async function searchHeldTicketIds(
    { module }: TestContext,
    showtimeId: string,
    customerId: string
) {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.searchHeldTicketIds(showtimeId, customerId)
}
