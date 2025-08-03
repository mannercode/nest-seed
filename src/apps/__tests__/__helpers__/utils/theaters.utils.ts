import { TestContext } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const buildCreateTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        location: { latitude: 0, longitude: 0 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    return createDto
}

export const createTheater = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateTheaterDto(override)

    const theater = await fix.theatersService.createTheater(createDto)
    return theater
}

export const createTheater2 = async ({ module }: TestContext, override = {}) => {
    const { TheatersClient } = await import('apps/cores')
    const theatersService = module.get(TheatersClient)

    const createDto = buildCreateTheaterDto(override)

    const theater = await theatersService.createTheater(createDto)
    return theater
}
