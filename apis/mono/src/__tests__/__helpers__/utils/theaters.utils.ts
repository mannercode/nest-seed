import type { TestContext } from '@mannercode/testing'
import type { CreateTheaterDto } from 'cores'

export function buildCreateTheaterDto(overrides: Partial<CreateTheaterDto> = {}): CreateTheaterDto {
    return {
        location: { latitude: 0, longitude: 0 },
        name: `theater name`,
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOXXOOOO' }] }] },
        ...overrides
    }
}

export async function createTheater(ctx: TestContext, override: Partial<CreateTheaterDto> = {}) {
    const { TheatersService } = await import('cores')
    const theatersService = ctx.module.get(TheatersService)

    const createDto = buildCreateTheaterDto(override)

    const theater = await theatersService.create(createDto)
    return theater
}
