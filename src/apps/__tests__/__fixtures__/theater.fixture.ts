import { CommonFixture } from '../__helpers__'

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
