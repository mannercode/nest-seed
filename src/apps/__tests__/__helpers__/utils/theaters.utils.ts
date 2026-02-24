import type { TestContext } from 'testlib'

export function buildCreateTheaterDto(overrides = {}) {
    const createDto = {
        location: { latitude: 0, longitude: 0 },
        name: `theater name`,
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    return createDto
}

export async function createTheater(ctx: TestContext, override = {}) {
    const { TheatersService } = await import('apps/cores')
    const theatersService = ctx.module.get(TheatersService)

    const createDto = buildCreateTheaterDto(override)

    const theater = await theatersService.create(createDto)
    return theater
}
