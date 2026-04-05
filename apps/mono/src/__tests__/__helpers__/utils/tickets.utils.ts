import { newObjectIdString, uniq } from '@mannercode/common'
import { oid, TestContext } from '@mannercode/testing'
import { TicketStatus, CreateTicketDto } from 'cores'

export function buildCreateTicketDto(overrides = {}) {
    const createDto = {
        movieId: oid(0x0),
        sagaId: newObjectIdString(),
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        showtimeId: oid(0x0),
        status: TicketStatus.Available,
        theaterId: oid(0x0),
        ...overrides
    }
    return createDto
}

export async function createTickets(ctx: TestContext, overrides: Partial<CreateTicketDto>[]) {
    const { TicketsService } = await import('cores')
    const ticketsService = ctx.module.get(TicketsService)

    const createDtos = overrides.map((override) => buildCreateTicketDto(override))

    const { success } = await ticketsService.createMany(createDtos)
    expect(success).toBe(true)

    const sagaIds = uniq(createDtos.map((dto) => dto.sagaId))

    const tickets = await ticketsService.search({ sagaIds })
    return tickets
}

export async function getTickets(ctx: TestContext, ticketIds: string[]) {
    const { TicketsService } = await import('cores')
    const ticketsService = ctx.module.get(TicketsService)

    return ticketsService.getMany(ticketIds)
}
