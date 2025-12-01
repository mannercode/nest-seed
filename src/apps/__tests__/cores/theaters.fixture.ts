import { TheaterDto, TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersController } from 'apps/gateway'
import { createTheater, TestFixture, createTestFixture } from '../__helpers__'

export type TheatersFixture = TestFixture & { createdTheater: TheaterDto }

export async function createTheatersFixture() {
    const fix = await createTestFixture({
        imports: [TheatersModule],
        providers: [TheatersClient],
        controllers: [TheatersController]
    })

    const createdTheater = await createTheater(fix)

    return { ...fix, createdTheater }
}
