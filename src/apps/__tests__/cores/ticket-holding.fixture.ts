import { HoldTicketsDto } from 'apps/cores'
import { nullObjectId, testObjectId } from 'testlib'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export const holdTickets = async (fix: CommonFixture, holdDto?: Partial<HoldTicketsDto>) => {
    return fix.ticketHoldingClient.holdTickets({
        customerId: nullObjectId,
        showtimeId: nullObjectId,
        ticketIds: [testObjectId(0x30), testObjectId(0x31)],
        ...holdDto
    })
}

export const searchHeldTicketIds = async (
    fix: CommonFixture,
    showtimeId: string,
    customerId: string
) => {
    return fix.ticketHoldingClient.searchHeldTicketIds(showtimeId, customerId)
}

export const releaseTickets = async (
    fix: CommonFixture,
    showtimeId: string,
    customerId: string
) => {
    return fix.ticketHoldingClient.releaseTickets(showtimeId, customerId)
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const commonFixture = await createCommonFixture()

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown }
}
