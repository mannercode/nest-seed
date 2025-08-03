import { CreateTicketDto, TicketStatus } from 'apps/cores'
import { newObjectId } from 'common'
import { uniq } from 'lodash'
import { oid, TestContext } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const buildCreateTicketDto = (overrides = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: oid(0x0),
        theaterId: oid(0x0),
        showtimeId: oid(0x0),
        status: TicketStatus.Available,
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        ...overrides
    }
    return createDto
}

export const createTickets = async (fix: CommonFixture, overrides: Partial<CreateTicketDto>[]) => {
    const createDtos = overrides.map((override) => buildCreateTicketDto(override))

    const { success } = await fix.ticketsService.createTickets(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const tickets = await fix.ticketsService.searchTickets({ transactionIds })
    return tickets
}

export const getTickets = async (fix: CommonFixture, ticketIds: string[]) => {
    return fix.ticketsService.getTickets(ticketIds)
}

export const createTickets2 = async (
    { module }: TestContext,
    overrides: Partial<CreateTicketDto>[]
) => {
    const { TicketsClient } = await import('apps/cores')
    const ticketsService = module.get(TicketsClient)

    const createDtos = overrides.map((override) => buildCreateTicketDto(override))

    const { success } = await ticketsService.createTickets(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const tickets = await ticketsService.searchTickets({ transactionIds })
    return tickets
}

export const getTickets2 = async ({ module }: TestContext, ticketIds: string[]) => {
    const { TicketsClient } = await import('apps/cores')
    const ticketsService = module.get(TicketsClient)

    return ticketsService.getTickets(ticketIds)
}
