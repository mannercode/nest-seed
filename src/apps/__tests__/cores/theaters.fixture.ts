import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersController } from 'apps/gateway'
import type { AppTestContext } from 'apps/__tests__/__helpers__'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        imports: [TheatersModule],
        providers: [TheatersClient],
        controllers: [TheatersController]
    })

    return { ...ctx }
}
