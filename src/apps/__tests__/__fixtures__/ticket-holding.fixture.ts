import { HoldTicketsDto } from 'apps/cores'
import { oid } from 'testlib'
import { CommonFixture } from '../__helpers__'

export const holdTickets = async (fix: CommonFixture, holdDto?: Partial<HoldTicketsDto>) => {
    return fix.ticketHoldingService.holdTickets({
        customerId: oid(0x0),
        showtimeId: oid(0x0),
        ticketIds: [oid(0x1), oid(0x2)],
        ...holdDto
    })
}

export const releaseTickets = async (
    fix: CommonFixture,
    showtimeId: string,
    customerId: string
) => {
    return fix.ticketHoldingService.releaseTickets(showtimeId, customerId)
}

export const searchHeldTicketIds = async (
    fix: CommonFixture,
    showtimeId: string,
    customerId: string
) => {
    return fix.ticketHoldingService.searchHeldTicketIds(showtimeId, customerId)
}
