import { padNumber } from 'common'
import { TheatersService } from 'cores'
import { createAllTestContexts, AllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    theatersService: TheatersService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module
    const theatersService = module.get(TheatersService)
    return { testContext, theatersService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        latlong: { latitude: 38.123, longitude: 138.678 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    const expectedDto = { id: expect.any(String), ...createDto }

    return { createDto, expectedDto }
}

export const createTheater = async (theatersService: TheatersService, override = {}) => {
    const { createDto } = createTheaterDto(override)
    const theater = await theatersService.createTheater(createDto)
    return theater
}

export const createTheaters = async (
    theatersService: TheatersService,
    length: number = 20,
    overrides = {}
) => {
    return Promise.all(
        Array.from({ length }, async (_, index) =>
            createTheater(theatersService, {
                name: `Theater-${padNumber(index, 3)}`,
                latlong: { latitude: 38.123, longitude: 138.678 },
                seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
                ...overrides
            })
        )
    )
}
