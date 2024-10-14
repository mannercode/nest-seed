import { ShowtimesService } from 'services/showtimes'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
    service: ShowtimesService
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })
    const service = testContext.module.get(ShowtimesService)

    return { testContext, service }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const generateShowtimeCreationDtos = (overrides = {}) => {
    const creationDtos = {
        name: `showtime name`,
        latlong: { latitude: 38.123, longitude: 138.678 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    const expectedDto = { id: expect.anything(), ...creationDtos }

    return { createDto: creationDtos, expectedDto }
}
