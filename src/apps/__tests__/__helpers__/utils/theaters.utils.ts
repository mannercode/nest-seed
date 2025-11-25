import { TestContext } from 'testlib'

export const buildCreateTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        location: { latitude: 0, longitude: 0 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    return createDto
}

export const createTheater = async ({ module }: TestContext, override = {}) => {
    const { TheatersClient } = await import('apps/cores')
    const theatersService = module.get(TheatersClient)

    const createDto = buildCreateTheaterDto(override)

    const theater = await theatersService.create(createDto)
    return theater
}
