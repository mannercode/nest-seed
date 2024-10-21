import { padNumber } from 'common'
import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })

    return { testContext }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        latlong: { latitude: 38.123, longitude: 138.678 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    const expectedDto = { id: expect.anything(), ...createDto }

    return { createDto, expectedDto }
}

export const createTheater = async (client: HttpTestClient, override = {}) => {
    const { createDto } = createTheaterDto(override)

    const { body } = await client.post('/theaters').body(createDto).created()
    return body
}

export const createTheaters = async (
    client: HttpTestClient,
    length: number = 20,
    overrides = {}
) => {
    return Promise.all(
        Array.from({ length }, async (_, index) =>
            createTheater(client, {
                name: `Theater-${padNumber(index, 3)}`,
                latlong: { latitude: 38.123, longitude: 138.678 },
                seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
                ...overrides
            })
        )
    )
}
