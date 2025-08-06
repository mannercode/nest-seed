import { TheaterDto, TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersController } from 'apps/gateway'
import { createTheater2, HttpTestFixture, setupHttpTestContext } from '../__helpers__'

export interface Fixture extends HttpTestFixture {
    createdTheater: TheaterDto
}

export const createFixture = async () => {
    const context = await setupHttpTestContext({
        imports: [TheatersModule],
        providers: [TheatersClient],
        controllers: [TheatersController]
    })

    const createdTheater = await createTheater2(context)

    return { ...context, createdTheater }
}
