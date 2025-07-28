import { CreateTicketDto, TicketStatus } from 'apps/cores'
import { newObjectId } from 'common'
import { uniq } from 'lodash'
import { CommonFixture } from '../__helpers__'

export const buildCreateTicketDto = (overrides = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: newObjectId(),
        theaterId: newObjectId(),
        showtimeId: newObjectId(),
        status: TicketStatus.Available,
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        ...overrides
    }
    return createDto
}

export const createTickets = async (fix: CommonFixture, createDtos: CreateTicketDto[]) => {
    const { success } = await fix.ticketsService.createTickets(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const tickets = await fix.ticketsService.searchTickets({ transactionIds })
    return tickets
}

export const getTickets = async (fix: CommonFixture, ticketIds: string[]) => {
    return fix.ticketsService.getTickets(ticketIds)
}
