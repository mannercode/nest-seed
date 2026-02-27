import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { TheatersClient, TheatersModule } from 'apps/cores'
import { TheatersHttpController } from 'apps/gateway'

export type TheatersFixture = AppTestContext & {}

export async function createTheatersFixture() {
    const ctx = await createAppTestContext({
        controllers: [TheatersHttpController],
        imports: [TheatersModule],
        providers: [TheatersClient]
    })

    return { ...ctx }
}
