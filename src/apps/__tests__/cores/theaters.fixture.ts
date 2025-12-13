import { TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersController } from 'apps/gateway'
import { createAppTestContext, TestFixture } from '../__helpers__'

export type TheatersFixture = TestFixture & {}

export async function createTheatersFixture() {
    const fix = await createAppTestContext({
        imports: [TheatersModule],
        providers: [TheatersClient],
        controllers: [TheatersController]
    })

    return fix
}
