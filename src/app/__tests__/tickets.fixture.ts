import { omit } from 'lodash'
import { TicketCreateDto, TicketDto, TicketsService, TicketStatus } from 'services/tickets'
import { createHttpTestContext, HttpTestContext, nullObjectId } from 'testlib'
import { AppModule, configureApp } from '../app.module'

export interface Fixture {
    testContext: HttpTestContext
    ticketsService: TicketsService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const ticketsService = testContext.module.get(TicketsService)

    return { testContext, ticketsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createTicketDtos = (overrides = {}, length: number = 100) => {
    const createDtos: TicketCreateDto[] = []
    const expectedDtos: TicketDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = {
            batchId: nullObjectId,
            movieId: nullObjectId,
            theaterId: nullObjectId,
            showtimeId: nullObjectId,
            status: TicketStatus.available,
            seat: { block: '1b', row: '1r', seatnum: 1 },
            ...overrides
        }

        const expectedDto = {
            id: expect.any(String),
            ...omit(createDto, 'batchId')
        }

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export async function createTickets(service: TicketsService, createDtos: TicketCreateDto[]) {
    const { success } = await service.createTickets(createDtos)
    expect(success).toBeTruthy()

    const batchIds = Array.from(new Set(createDtos.map((dto) => dto.batchId)))

    const tickets = await service.findAllTickets({ batchIds })
    return tickets
}
