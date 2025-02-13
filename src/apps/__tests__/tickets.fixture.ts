import { TicketCreateDto, TicketDto, TicketsService, TicketStatus } from 'cores'
import { omit, uniq } from 'lodash'
import { nullObjectId } from 'testlib'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    ticketsService: TicketsService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module
    const ticketsService = module.get(TicketsService)

    return { testContext, ticketsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createTicketDto = (overrides = {}) => ({
    batchId: nullObjectId,
    movieId: nullObjectId,
    theaterId: nullObjectId,
    showtimeId: nullObjectId,
    status: TicketStatus.available,
    seat: { block: '1b', row: '1r', seatnum: 1 },
    ...overrides
})

export const createTicketDtos = (overrides = {}, length: number = 100) => {
    const createDtos: TicketCreateDto[] = []
    const expectedDtos: TicketDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = createTicketDto(overrides)

        const expectedDto = { id: expect.any(String), ...omit(createDto, 'batchId') }

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export async function createTickets(service: TicketsService, createDtos: TicketCreateDto[]) {
    const { success } = await service.createTickets(createDtos)
    expect(success).toBeTruthy()

    const batchIds = uniq(createDtos.map((dto) => dto.batchId))

    const tickets = await service.findAllTickets({ batchIds })
    return tickets
}
