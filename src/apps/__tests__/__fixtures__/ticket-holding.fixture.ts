import { HoldTicketsDto } from 'apps/cores'
import { newObjectId } from 'common'
import { testObjectId } from 'testlib'
import { CommonFixture } from '../__helpers__'

export const holdTickets = async (fix: CommonFixture, holdDto?: Partial<HoldTicketsDto>) => {
    return fix.ticketHoldingService.holdTickets({
        customerId: newObjectId(),
        showtimeId: newObjectId(),
        ticketIds: [testObjectId(0x1), testObjectId(0x2)],
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
