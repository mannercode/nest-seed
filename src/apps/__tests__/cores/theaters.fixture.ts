import { TheaterDto } from 'apps/cores'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import { createTheater } from '../common.fixture'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    theater: TheaterDto
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const theater = await createTheater(fix)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, theater }
}
