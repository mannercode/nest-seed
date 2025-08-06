import { HoldTicketsDto } from 'apps/cores'
import { oid, TestContext } from 'testlib'

export const holdTickets2 = async ({ module }: TestContext, holdDto?: Partial<HoldTicketsDto>) => {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.holdTickets({
        customerId: oid(0x0),
        showtimeId: oid(0x0),
        ticketIds: [oid(0x1), oid(0x2)],
        ...holdDto
    })
}

export const releaseTickets2 = async (
    { module }: TestContext,
    showtimeId: string,
    customerId: string
) => {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.releaseTickets(showtimeId, customerId)
}

export const searchHeldTicketIds2 = async (
    { module }: TestContext,
    showtimeId: string,
    customerId: string
) => {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingService = module.get(TicketHoldingClient)

    return ticketHoldingService.searchHeldTicketIds(showtimeId, customerId)
}
