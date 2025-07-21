import { CommonFixture, createCommonFixture } from '../__helpers__'

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
