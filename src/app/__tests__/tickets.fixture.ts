import { omit } from 'lodash'
import { TicketCreateDto, TicketDto, TicketsService, TicketStatus } from 'services/tickets'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'


export interface IsolatedFixture {
    testContext: HttpTestContext
    service: TicketsService
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const service = testContext.module.get(TicketsService)

    return { testContext, service }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createTicketDtos = (overrides = {}, length: number = 100) => {
    const createDtos: TicketCreateDto[] = []
    const expectedDtos: TicketDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = {
            batchId: '100000000000000000000000',
            movieId: '200000000000000000000000',
            theaterId: '300000000000000000000000',
            showtimeId: '400000000000000000000000',
            status: TicketStatus.open,
            seat: { block: '1b', row: '1r', seatnum: 1 },
            ...overrides
        }

        const expectedDto = {
            id: expect.anything(),
            ...omit(createDto, 'batchId'),
            status: 'open'
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
