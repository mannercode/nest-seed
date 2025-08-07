import { TheaterDto, TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersController } from 'apps/gateway'
import { createTheater, TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    createdTheater: TheaterDto
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [TheatersModule],
        providers: [TheatersClient],
        controllers: [TheatersController]
    })

    const createdTheater = await createTheater(fix)

    return { ...fix, createdTheater }
}
