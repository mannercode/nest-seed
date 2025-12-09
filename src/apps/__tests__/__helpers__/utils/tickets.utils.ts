import { CreateTicketDto, TicketStatus } from 'apps/cores'
import { newObjectId } from 'common'
import { uniq } from 'lodash'
import { oid, TestContext } from 'testlib'

export function buildCreateTicketDto(overrides = {}) {
    const createDto = {
        sagaId: newObjectId(),
        movieId: oid(0x0),
        theaterId: oid(0x0),
        showtimeId: oid(0x0),
        status: TicketStatus.Available,
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        ...overrides
    }
    return createDto
}

export async function createTickets(
    { module }: TestContext,
    overrides: Partial<CreateTicketDto>[]
) {
    const { TicketsClient } = await import('apps/cores')
    const ticketsService = module.get(TicketsClient)

    const createDtos = overrides.map((override) => buildCreateTicketDto(override))

    const { success } = await ticketsService.createMany(createDtos)
    expect(success).toBe(true)

    const sagaIds = uniq(createDtos.map((dto) => dto.sagaId))

    const tickets = await ticketsService.search({ sagaIds })
    return tickets
}

export async function getTickets({ module }: TestContext, ticketIds: string[]) {
    const { TicketsClient } = await import('apps/cores')
    const ticketsService = module.get(TicketsClient)

    return ticketsService.getMany(ticketIds)
}
